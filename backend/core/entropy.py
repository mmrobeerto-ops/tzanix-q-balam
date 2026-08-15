import math

def calculate_shannon_entropy(data: bytes) -> float:
    """
    Calcula la Entropía de Shannon de un flujo de bytes.
    Retorna un valor entre 0 y 8. Valores > 7.5 indican alta probabilidad de cifrado o compresión (posible exfiltración/malware).
    """
    if not data:
        return 0.0
        
    entropy = 0.0
    length = len(data)
    
    # Contar frecuencia de cada byte (0-255)
    frequencies = [0] * 256
    for byte in data:
        frequencies[byte] += 1
        
    for count in frequencies:
        if count > 0:
            probability = count / length
            entropy -= probability * math.log2(probability)
            
    return entropy
