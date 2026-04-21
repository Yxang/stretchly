import {
  exposeI18next,
  exposeRuntime,
  exposeSettings,
  exposeSoftReminder
} from './utils/context-bridge-exposers.js'

exposeI18next()
exposeRuntime()
exposeSettings()
exposeSoftReminder()
