import json
import logging
from datetime import datetime
import os

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, 'soc_audit.log')

# Setup logging
logger = logging.getLogger("tzanix_soc")
logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(LOG_FILE)
file_handler.setFormatter(logging.Formatter('%(message)s'))
logger.addHandler(file_handler)

def log_soc_event(source_ip: str, dest_ip: str, entropy: float, bytes_len: int, action: str, mitre_tags: list):
    """
    Despacha un evento en formato JSON estructurado listo para ingesta en SIEM (Splunk, Elastic, Datadog).
    """
    event = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "app": "tzanix_q_balam",
        "event_type": "security_audit",
        "source_ip": source_ip,
        "destination_ip": dest_ip,
        "payload_metrics": {
            "bytes": bytes_len,
            "shannon_entropy": round(entropy, 4)
        },
        "action_taken": action, # ALLOW, BLOCK, SIMULATED_BLOCK
        "mitre_attack": mitre_tags
    }
    
    # Escribir en log file
    logger.info(json.dumps(event))
    return event
