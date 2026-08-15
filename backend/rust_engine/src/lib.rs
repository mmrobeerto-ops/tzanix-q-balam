use pyo3::prelude::*;

/// Calcula la entropía de Shannon en microsegundos usando Rust puro.
#[pyfunction]
fn calculate_shannon_entropy(data: &[u8]) -> f64 {
    let length = data.len();
    if length == 0 {
        return 0.0;
    }

    let mut frequencies = [0usize; 256];
    for &byte in data {
        frequencies[byte as usize] += 1;
    }

    let mut entropy = 0.0;
    let length_f64 = length as f64;

    for &count in frequencies.iter() {
        if count > 0 {
            let probability = (count as f64) / length_f64;
            entropy -= probability * probability.log2();
        }
    }

    entropy
}

/// Módulo raíz exportado a Python
#[pymodule]
fn rust_engine(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(calculate_shannon_entropy, m)?)?;
    Ok(())
}
