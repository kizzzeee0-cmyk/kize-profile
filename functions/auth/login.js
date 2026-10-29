import { passwordLogin } from '../_lib/auth.js'

export async function onRequestPost({ request, env }) {
  return passwordLogin(request, env)
}
