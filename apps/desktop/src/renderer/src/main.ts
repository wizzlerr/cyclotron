import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import { i18n } from './i18n/i18n.svelte'
import { display } from './lib/display.svelte'

display.apply()
i18n.apply()

mount(App, { target: document.getElementById('app')! })
