
package mnemos.authz

default allow = false

# Example: only allow marking memory as 'permanent' if actor has role 'admin'
allow {
  input.action == "memory.set_strength"
  input.payload.strength == "permanent"
  input.actor.roles[_] == "admin"
}

# allow other actions by default (dev only - tighten in prod)
allow {
  input.action != "memory.set_strength"
}
