# =============================================================================
# HealthFlow Sunbird RC v2 - Deployment Automation
# Terraform configuration for automated OpenHIM deployment
# =============================================================================

# Local file for deployment script
resource "local_file" "deployment_script" {
  filename = "${path.module}/deploy-openhim.sh"
  content  = file("${path.module}/../scripts/deploy-openhim.sh")
}

# Remote execution of deployment script
resource "null_resource" "deploy_openhim" {
  depends_on = [
    digitalocean_droplet.sunbird_rc,
    digitalocean_volume_attachment.sunbird_data
  ]

  provisioner "remote-exec" {
    inline = [
      "set -e",
      "echo 'Waiting for droplet to be fully ready...'",
      "sleep 30",
      "echo 'Preparing deployment environment...'",
      "mkdir -p /opt",
      "cd /opt",
      "git clone https://github.com/HealthFlowEgy/NDRP-backend.git || (cd NDRP-backend && git pull origin main)",
      "cd NDRP-backend",
      "chmod +x scripts/deploy-openhim.sh",
      "echo 'Starting OpenHIM deployment...'",
      "bash scripts/deploy-openhim.sh ${var.environment}",
      "echo 'Deployment completed successfully!'"
    ]

    connection {
      type        = "ssh"
      user        = "root"
      private_key = file("~/.ssh/id_rsa")
      host        = digitalocean_reserved_ip.sunbird_rc.ip_address
      timeout     = "30m"
    }
  }

  provisioner "local-exec" {
    command = "echo 'Deployment completed at' $(date)"
  }
}

# Output deployment status
output "deployment_status" {
  description = "Deployment status"
  value       = "OpenHIM deployment completed. Access at http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:9000"
}

output "deployment_endpoints" {
  description = "All service endpoints"
  value = {
    openhim_console = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:9000"
    openhim_core    = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:8080"
    registry_api    = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:8081"
    jempi_ui        = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:3033"
    jempi_api       = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:50000"
    hapi_fhir       = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:8888"
    elasticsearch   = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:9200"
    kibana          = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:5601"
    keycloak        = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:8080/auth"
    prometheus      = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:9090"
    grafana         = "http://${digitalocean_reserved_ip.sunbird_rc.ip_address}:3000"
  }
}
