// The virtual world (E16, DESIGN.md D22): a low-poly rider on a road that follows the route's shape
// and elevation, or an endless straight road without a route. Loaded on demand (dynamic import),
// so riders who never turn it on don't pay for Three.js. It only reads the ride's state through
// `feed`, never changes it, so BLE, ERG and recording behave the same with it on or off.
import {
  densify,
  extendEnds,
  frameAt,
  groundHeight,
  hashString,
  legPose,
  RIDER_DIMS,
  RoadIndex,
  routeToLocal,
  scatterTrees,
  straightRoad,
  type TerrainGrid,
  type Route,
  type WorldPoint,
} from '@cyclotron/core'
import * as THREE from 'three'
import { buildTerrain, type TerrainRequest, type TerrainResult } from './terrain'

export type WorldQuality = 'low' | 'high'

/** What the world needs from the ride, read every frame. */
export interface WorldFeed {
  route?: Route
  /** Position along the route (wraps when a workout outlasts it). */
  routeD?: number
  speedMps: number
  cadenceRpm: number
  running: boolean
}

export interface WorldView {
  setQuality(q: WorldQuality): void
  dispose(): void
}

const FPS = 30
/** Vertical field of view, degrees; widened on narrow panels to keep this much across. */
const V_FOV = 55
const MIN_H_FOV = 80
const MAX_V_FOV = 85
const ROAD_HALF_W = 3
/** The rider keeps to the right half of the road. */
const LANE_OFFSET = 1.3
/** Without a route: a straight road whose scenery repeats every PERIOD metres. */
const STRAIGHT_LEN = 1400
const STRAIGHT_START = 400
/** A multiple of the 12 m dash pattern; hills and trees repeat with it too. */
const PERIOD = 240
const WHEEL_R = 0.34
/** Chase camera: this far back along the road (at least CAM_MIN_M away), this high above the rider. */
const CAM_BACK_M = 7
const CAM_MIN_M = 6
const CAM_UP_M = 2.4
/** The camera aims this far ahead of the rider (a little lead, the rider stays in frame). */
const CAM_LEAD_M = 4
/** Snap instead of easing when the ride's position jumps (route wrapped, ride reloaded). */
const SNAP_M = 50
/** Per second: how fast the shown speed follows the ride's, and the position its true value. */
const SPEED_EASE = 2
const POSITION_EASE = 0.5

const SKY = new THREE.Color(0xa9c8e8)

const COLORS = {
  sky: 0xa9c8e8,
  road: 0x3b3f45,
  line: 0xe8e2c8,
  grass: new THREE.Color(0x5f8f4a),
  grassDark: new THREE.Color(0x46703a),
  trunk: 0x6b4a2f,
  leaves: 0x2f6b3a,
  jersey: 0x3987e5,
  shorts: 0x1d2229,
  skin: 0xe0b28f,
  bike: 0x22262c,
  tyre: 0x111111,
  post: 0xf2f2f2,
}

export function createWorld(
  canvas: HTMLCanvasElement,
  feed: () => WorldFeed,
  quality: WorldQuality,
): WorldView {
  let q = quality
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q === 'high' })
  const pixelRatio = (): number => (q === 'high' ? Math.min(window.devicePixelRatio, 2) : 1)
  renderer.setPixelRatio(pixelRatio())

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLORS.sky)
  scene.fog = new THREE.Fog(COLORS.sky, 60, q === 'high' ? 700 : 450)
  const camera = new THREE.PerspectiveCamera(V_FOV, 16 / 9, 0.3, 1500)
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(-300, 500, 200)
  scene.add(sun)

  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x)

  // --- The road and the land around it --------------------------------------------------------
  const route = feed().route
  const straight = !route
  const seed = hashString(route?.id ?? 'straight')
  const periodZ = route ? undefined : PERIOD
  const centre: WorldPoint[] = route
    ? densify(extendEnds(routeToLocal(route), 40), 5)
    : straightRoad(STRAIGHT_LEN, 5)
  const index = new RoadIndex(centre)
  scene.add(roadMesh(centre, track))
  let disposed = false
  const terrainWorker = loadTerrain()
  const minY = centre.reduce((m, p) => Math.min(m, p.y), Infinity)
  const far = new THREE.Mesh(
    track(new THREE.PlaneGeometry(20000, 20000).rotateX(-Math.PI / 2)),
    track(new THREE.MeshLambertMaterial({ color: COLORS.grassDark })),
  )
  far.position.y = minY - 25
  scene.add(far)
  scene.add(trees(q))
  if (route) for (const m of kmMarkers(centre, track)) scene.add(m)

  function roadMesh(pts: WorldPoint[], keep: typeof track): THREE.Group {
    const g = new THREE.Group()
    const pos: number[] = []
    const idx: number[] = []
    const line: number[] = []
    const lineIdx: number[] = []
    pts.forEach((p, i) => {
      const f = frameAt(pts, p.d, 4)
      // Left of the heading is (hz, −hx).
      pos.push(p.x + f.hz * ROAD_HALF_W, p.y, p.z - f.hx * ROAD_HALF_W)
      pos.push(p.x - f.hz * ROAD_HALF_W, p.y, p.z + f.hx * ROAD_HALF_W)
      if (i > 0) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i)
      // Dashed centre line: 3 m on, 3 m off (every 5 m point pair).
      if (Math.floor(p.d / 6) % 2 === 0) {
        const n = line.length / 3
        line.push(p.x + f.hz * 0.06, p.y + 0.02, p.z - f.hx * 0.06)
        line.push(p.x - f.hz * 0.06, p.y + 0.02, p.z + f.hx * 0.06)
        const q2 = pts[i + 1]
        if (q2) {
          line.push(q2.x + f.hz * 0.06, q2.y + 0.02, q2.z - f.hx * 0.06)
          line.push(q2.x - f.hz * 0.06, q2.y + 0.02, q2.z + f.hx * 0.06)
          lineIdx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2)
        }
      }
    })
    const road = keep(new THREE.BufferGeometry())
    road.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    road.setIndex(idx)
    road.computeVertexNormals()
    g.add(
      new THREE.Mesh(
        road,
        keep(
          new THREE.MeshLambertMaterial({
            color: COLORS.road,
            polygonOffset: true,
            polygonOffsetFactor: -1,
          }),
        ),
      ),
    )
    const dashes = keep(new THREE.BufferGeometry())
    dashes.setAttribute('position', new THREE.Float32BufferAttribute(line, 3))
    dashes.setIndex(lineIdx)
    g.add(
      new THREE.Mesh(
        dashes,
        keep(
          new THREE.MeshBasicMaterial({
            color: COLORS.line,
            polygonOffset: true,
            polygonOffsetFactor: -2,
          }),
        ),
      ),
    )
    return g
  }

  /**
   * The ground (see terrainGrid), built in a worker so long routes don't freeze the window; it
   * appears a moment after the road and the rider.
   */
  function loadTerrain(): Worker | undefined {
    const request: TerrainRequest = { pts: centre, seed, periodZ: straight ? PERIOD : undefined }
    const show = (r: TerrainResult): void => {
      if (disposed) return
      scene.add(terrainMesh(r.near, 0))
      scene.add(terrainMesh(r.far, 0.12))
    }
    try {
      const worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<TerrainResult>) => {
        show(e.data)
        worker.terminate()
      }
      // If the worker can't run, build it here (a short freeze on long routes beats no ground).
      worker.onerror = (e) => {
        e.preventDefault()
        worker.terminate()
        show(buildTerrain(request))
      }
      worker.postMessage(request)
      return worker
    } catch {
      show(buildTerrain(request))
      return undefined
    }
  }

  /** `haze` lightens the colour a little (distant land). */
  function terrainMesh(grid: TerrainGrid, haze: number): THREE.Mesh {
    const col = new Float32Array(grid.positions.length)
    const c = new THREE.Color()
    for (let i = 0; i < grid.positions.length; i += 3) {
      const x = grid.positions[i]!
      const z = grid.positions[i + 2]!
      const shade = (Math.sin(x * 0.05) + Math.cos(z * 0.04) + 2) / 4
      c.copy(COLORS.grass).lerp(COLORS.grassDark, shade).lerp(SKY, haze)
      col[i] = c.r
      col[i + 1] = c.g
      col[i + 2] = c.b
    }
    const geo = track(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.BufferAttribute(grid.positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setIndex(new THREE.BufferAttribute(grid.indices, 1))
    geo.computeVertexNormals()
    return new THREE.Mesh(geo, track(new THREE.MeshLambertMaterial({ vertexColors: true })))
  }

  function trees(qual: WorldQuality): THREE.Group {
    const every = qual === 'high' ? 10 : 18
    let spots = scatterTrees(
      straight ? centre.filter((p) => p.d <= PERIOD) : centre,
      seed,
      every,
      7,
      qual === 'high' ? 90 : 60,
      index,
      straight ? PERIOD : undefined,
    )
    // On the straight road one period of trees repeats along its whole length.
    if (straight) {
      spots = Array.from({ length: Math.ceil(STRAIGHT_LEN / PERIOD) }, (_, k) =>
        spots.map((t) => ({ ...t, z: t.z - k * PERIOD })),
      ).flat()
    }
    const trunkGeo = track(new THREE.CylinderGeometry(0.18, 0.25, 2.2, 6).translate(0, 1.1, 0))
    const leafGeo = track(new THREE.ConeGeometry(1.6, 5.5, 7).translate(0, 4.6, 0))
    const trunks = new THREE.InstancedMesh(
      trunkGeo,
      track(new THREE.MeshLambertMaterial({ color: COLORS.trunk })),
      spots.length,
    )
    const leaves = new THREE.InstancedMesh(
      leafGeo,
      track(new THREE.MeshLambertMaterial({ color: COLORS.leaves })),
      spots.length,
    )
    const m = new THREE.Matrix4()
    spots.forEach((t, i) => {
      m.makeScale(t.scale, t.scale, t.scale).setPosition(t.x, t.y, t.z)
      trunks.setMatrixAt(i, m)
      leaves.setMatrixAt(i, m)
    })
    const g = new THREE.Group()
    g.add(trunks, leaves)
    return g
  }

  function kmMarkers(pts: WorldPoint[], keep: typeof track): THREE.Object3D[] {
    const out: THREE.Object3D[] = []
    const postGeo = keep(new THREE.BoxGeometry(0.15, 1.2, 0.15).translate(0, 0.6, 0))
    const postMat = keep(new THREE.MeshLambertMaterial({ color: COLORS.post }))
    // Up to the real finish, not into the run-out past it.
    const end = route?.distanceM ?? pts.at(-1)!.d
    for (let km = 1; km * 1000 < end; km++) {
      const f = frameAt(pts, km * 1000)
      const x = f.x - f.hz * (ROAD_HALF_W + 0.8)
      const z = f.z + f.hx * (ROAD_HALF_W + 0.8)
      const post = new THREE.Mesh(postGeo, postMat)
      post.position.set(x, f.y, z)
      const label = textSprite(`${km} km`, keep)
      label.position.set(x, f.y + 1.7, z)
      out.push(post, label)
    }
    return out
  }

  // --- The rider ------------------------------------------------------------------------------
  const rider = buildRider(track)
  scene.add(rider.group)

  // --- Per frame ------------------------------------------------------------------------------
  let worldD = straight ? 0 : (feed().routeD ?? 0)
  let speed = 0
  /** Dev only: holds the rider at a distance, for looking at a stretch of road. */
  let debugD: number | undefined
  let lastRouteD: number | undefined
  let routeDAt = 0
  /** Dev only: metres per second moved in each recent frame, to check smoothness. */
  const steps: number[] = []
  let crank = 0
  const camPos = new THREE.Vector3()
  const camLook = new THREE.Vector3()
  let camReady = false
  let last = performance.now()
  let lastDraw = 0
  let raf = 0

  function frame(now: number): void {
    raf = requestAnimationFrame(frame)
    // Nothing to draw for a hidden or minimised window (rides keep ticking without us).
    if (document.visibilityState === 'hidden') {
      last = now
      return
    }
    if (now - lastDraw < 1000 / FPS - 2) return
    lastDraw = now
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    const f = feed()
    // Speed changes in steps (1 Hz ride ticks, trainer notifications): smooth it.
    const target = f.running ? f.speedMps : 0
    speed += (target - speed) * Math.min(1, dt * SPEED_EASE)

    const before = worldD
    worldD += speed * dt
    if (!straight && f.routeD !== undefined) {
      // The ride's position is the truth but only updates once a second: compare with where it
      // is now (last report + distance since), so the correction stays small and continuous
      // instead of a catch-up surge after every tick.
      if (f.routeD !== lastRouteD) {
        lastRouteD = f.routeD
        routeDAt = now
      }
      const truth = f.routeD + speed * ((now - routeDAt) / 1000)
      const diff = truth - worldD
      worldD = Math.abs(diff) > SNAP_M ? truth : worldD + diff * Math.min(1, dt * POSITION_EASE)
    }
    if (import.meta.env.DEV && dt > 0) {
      steps.push((worldD - before) / dt)
      if (steps.length > 300) steps.shift()
    }
    if (debugD !== undefined) worldD = debugD
    const roadD = straight ? STRAIGHT_START + (((worldD % PERIOD) + PERIOD) % PERIOD) : worldD

    const fr = frameAt(centre, roadD, 6)
    // Right of the heading is (−hz, hx).
    const x = fr.x - fr.hz * LANE_OFFSET
    const z = fr.z + fr.hx * LANE_OFFSET
    rider.group.position.set(x, fr.y, z)
    rider.group.rotation.set(0, Math.atan2(-fr.hx, -fr.hz), 0)
    rider.body.rotation.x = Math.atan(fr.slope)

    if (f.running && f.cadenceRpm > 0) crank += (f.cadenceRpm / 60) * Math.PI * 2 * dt
    rider.pose(crank, speed * dt)

    // Chase camera: behind and above, looking a little ahead; eased so turns feel smooth.
    // Chase camera on the road behind (not straight back, which is inside the hill on a hairpin),
    // at least CAM_MIN_M from the rider, above the rider and the ground, aimed at the rider with a
    // slight lead along the heading so the rider stays in frame through hairpins.
    const back = frameAt(centre, roadD - CAM_BACK_M, 6)
    let bx = back.x - back.hz * LANE_OFFSET
    let bz = back.z + back.hx * LANE_OFFSET
    const away = Math.hypot(bx - x, bz - z)
    if (away < CAM_MIN_M) {
      // Round a tight bend the road behind is too close: back off along the line to it (or
      // straight back when they coincide).
      const ux = away > 0.1 ? (bx - x) / away : -fr.hx
      const uz = away > 0.1 ? (bz - z) / away : -fr.hz
      bx = x + ux * CAM_MIN_M
      bz = z + uz * CAM_MIN_M
    }
    const by = Math.max(fr.y + CAM_UP_M, groundHeight(index, bx, bz, seed, periodZ) + 1.5)
    const behind = new THREE.Vector3(bx, by, bz)
    const ahead = new THREE.Vector3(
      x + fr.hx * CAM_LEAD_M,
      fr.y + 1.1 + fr.slope * CAM_LEAD_M,
      z + fr.hz * CAM_LEAD_M,
    )
    if (!camReady) {
      camPos.copy(behind)
      camLook.copy(ahead)
      camReady = true
    }
    const k = Math.min(1, dt * 3)
    camPos.lerp(behind, k)
    camLook.lerp(ahead, k)
    camera.position.copy(camPos)
    camera.lookAt(camLook)

    resize()
    renderer.render(scene, camera)
  }

  let sized = { w: 0, h: 0, ratio: 0 }

  /** Follows the panel's size and the display's pixel ratio (window moves, interface zoom). */
  function resize(): void {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const ratio = pixelRatio()
    if (w === 0 || h === 0) return
    if (w === sized.w && h === sized.h && ratio === sized.ratio) return
    sized = { w, h, ratio }
    renderer.setPixelRatio(ratio)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Keep at least MIN_H_FOV degrees across, so narrow windows still show the road ahead.
    const minV =
      (2 * Math.atan(Math.tan((MIN_H_FOV * Math.PI) / 360) / camera.aspect) * 180) / Math.PI
    camera.fov = Math.min(MAX_V_FOV, Math.max(V_FOV, minV))
    camera.updateProjectionMatrix()
  }

  raf = requestAnimationFrame(frame)
  if (import.meta.env.DEV) {
    ;(window as unknown as { __world?: unknown }).__world = {
      camera,
      rider: rider.group,
      ground: (x: number, z: number) => groundHeight(index, x, z, seed),
      frameAt: (d: number) => frameAt(centre, d),
      steps,
      jump: (d: number | undefined) => (debugD = d),
    }
  }

  return {
    setQuality(next) {
      q = next
      sized = { w: 0, h: 0, ratio: 0 }
      ;(scene.fog as THREE.Fog).far = q === 'high' ? 700 : 450
    },
    dispose() {
      disposed = true
      terrainWorker?.terminate()
      cancelAnimationFrame(raf)
      for (const d of disposables) d.dispose()
      renderer.dispose()
    },
  }
}

/** A low-poly rider on a bike, built facing −z. `pose` turns the cranks and wheels. */
function buildRider(track: <T extends { dispose(): void }>(x: T) => T): {
  group: THREE.Group
  body: THREE.Group
  pose(crank: number, rolledM: number): void
} {
  const mat = (color: number): THREE.MeshLambertMaterial =>
    track(new THREE.MeshLambertMaterial({ color }))
  const box = (w: number, h: number, d: number): THREE.BoxGeometry =>
    track(new THREE.BoxGeometry(w, h, d))
  const group = new THREE.Group()
  // Pitched with the slope around the rear wheel's contact point.
  const body = new THREE.Group()
  group.add(body)

  const BB = new THREE.Vector3(0, WHEEL_R + 0.02, -0.05) // bottom bracket
  const wheelGeo = track(new THREE.TorusGeometry(WHEEL_R, 0.025, 6, 20).rotateY(Math.PI / 2))
  const wheels = [0.5, -0.55].map((zz) => {
    const w = new THREE.Mesh(wheelGeo, mat(COLORS.tyre))
    w.position.set(0, WHEEL_R, zz)
    body.add(w)
    return w
  })
  const frameMat = mat(COLORS.bike)
  const tube = (from: THREE.Vector3, to: THREE.Vector3): void => {
    const len = from.distanceTo(to)
    const m = new THREE.Mesh(box(0.04, 0.04, len), frameMat)
    m.position.copy(from).add(to).multiplyScalar(0.5)
    m.lookAt(to.x, to.y, to.z)
    body.add(m)
  }
  const seatTop = new THREE.Vector3(0, BB.y + 0.62, BB.z + 0.18)
  const headTop = new THREE.Vector3(0, BB.y + 0.6, -0.48)
  tube(BB, seatTop)
  tube(BB, headTop)
  tube(seatTop, headTop)
  tube(BB, new THREE.Vector3(0, WHEEL_R, 0.5))
  tube(seatTop, new THREE.Vector3(0, WHEEL_R, 0.5))
  tube(headTop, new THREE.Vector3(0, WHEEL_R, -0.55))

  // Rider: hips over the saddle, torso leaning forward to the bars.
  const hip = new THREE.Vector3(0, BB.y + RIDER_DIMS.hipY, BB.z - RIDER_DIMS.hipX)
  const torso = new THREE.Mesh(box(0.34, 0.58, 0.2), mat(COLORS.jersey))
  torso.geometry.translate(0, 0.29, 0)
  torso.position.copy(hip)
  torso.rotation.x = -1.0
  body.add(torso)
  const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 10, 8)), mat(COLORS.skin))
  head.position.set(0, hip.y + 0.42, hip.z - 0.55)
  body.add(head)
  const helmet = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
    mat(COLORS.jersey),
  )
  helmet.position.copy(head.position).add(new THREE.Vector3(0, 0.02, 0))
  body.add(helmet)
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(box(0.07, 0.07, 0.5), mat(COLORS.jersey))
    arm.position.set(side * 0.17, hip.y + 0.3, hip.z - 0.6)
    arm.rotation.x = 0.9
    body.add(arm)
  }

  // Legs: thigh pivots at the hip, shin at the knee; angles from `legPose`.
  const legs = [-1, 1].map((side) => {
    const thigh = new THREE.Group()
    thigh.position.set(side * 0.11, hip.y, hip.z)
    const thighMesh = new THREE.Mesh(box(0.13, RIDER_DIMS.thigh, 0.13), mat(COLORS.shorts))
    thighMesh.position.y = -RIDER_DIMS.thigh / 2
    thigh.add(thighMesh)
    const shin = new THREE.Group()
    shin.position.y = -RIDER_DIMS.thigh
    const shinMesh = new THREE.Mesh(box(0.1, RIDER_DIMS.shin, 0.1), mat(COLORS.skin))
    shinMesh.position.y = -RIDER_DIMS.shin / 2
    shin.add(shinMesh)
    thigh.add(shin)
    body.add(thigh)
    return { thigh, shin }
  })

  return {
    group,
    body,
    pose(crank, rolledM) {
      legs.forEach((leg, i) => {
        const p = legPose(crank + i * Math.PI)
        leg.thigh.rotation.x = p.hip
        leg.shin.rotation.x = -p.knee
      })
      for (const w of wheels) w.rotation.x -= rolledM / WHEEL_R
    },
  }
}

/** A small text label that always faces the camera. */
function textSprite(text: string, track: <T extends { dispose(): void }>(x: T) => T): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 48
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 128, 48)
  g.fillStyle = '#1b2027'
  g.font = 'bold 28px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 64, 25)
  const tex = track(new THREE.CanvasTexture(c))
  const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: tex, fog: true })))
  s.scale.set(1.6, 0.6, 1)
  return s
}
