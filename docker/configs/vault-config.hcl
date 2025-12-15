# =============================================================================
# HealthFlow Sunbird RC v2 - Vault Configuration
# HashiCorp Vault for Key Management
# =============================================================================

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

api_addr = "http://0.0.0.0:8200"
cluster_addr = "http://0.0.0.0:8201"

disable_mlock = true
ui = true

# Telemetry
telemetry {
  disable_hostname = true
  prometheus_retention_time = "30s"
}

# Default lease duration
default_lease_ttl = "768h"
max_lease_ttl = "8760h"
