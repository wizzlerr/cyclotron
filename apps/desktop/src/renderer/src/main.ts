import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import { display } from './lib/display.svelte'

display.apply()

mount(App, { target: document.getElementById('app')! })
