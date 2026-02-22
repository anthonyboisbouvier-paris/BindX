import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      console.error('[API] Backend non disponible')
      error.userMessage = 'Le serveur backend est inaccessible. Verifiez que le backend est demarré sur le port 8000.'
    } else if (error.response) {
      const status = error.response.status
      if (status === 404) {
        error.userMessage = 'Ressource introuvable.'
      } else if (status === 422) {
        const detail = error.response.data?.detail
        if (Array.isArray(detail)) {
          error.userMessage = detail.map(d => d.msg).join(', ')
        } else {
          error.userMessage = detail || 'Donnees invalides.'
        }
      } else if (status >= 500) {
        error.userMessage = 'Erreur serveur interne. Consultez les logs du backend.'
      } else {
        error.userMessage = error.response.data?.detail || 'Une erreur est survenue.'
      }
    } else {
      error.userMessage = 'Erreur de connexion au serveur.'
    }
    return Promise.reject(error)
  }
)

/**
 * Create a new docking job
 * @param {Object} params - Job parameters
 * @param {string} params.uniprot_id - UniProt ID (e.g. P00533)
 * @param {string} [params.sequence] - Raw amino acid sequence (alternative to uniprot_id)
 * @param {string[]} [params.custom_smiles] - Custom SMILES strings
 * @param {boolean} [params.use_chembl] - Use ChEMBL ligands
 * @param {boolean} [params.use_zinc] - Use ZINC ligands
 * @param {number} [params.max_ligands] - Max number of ligands
 * @param {string} [params.mode] - Analysis mode: 'basic' | 'advanced'
 * @param {string} [params.docking_engine] - Engine: 'vina' | 'diffdock'
 * @param {string} [params.notification_email] - Optional email for job completion notification
 * @returns {Promise<{job_id: string}>}
 */
export async function createJob(params) {
  // Pass all V3 fields through as-is; the backend ignores unknown fields gracefully
  const response = await apiClient.post('/jobs', params)
  return response.data
}

/**
 * Get job status and progress
 * @param {string} jobId
 * @returns {Promise<{job_id: string, status: string, progress: number, current_step: string, error?: string}>}
 */
export async function getJobStatus(jobId) {
  const response = await apiClient.get(`/jobs/${jobId}`)
  return response.data
}

/**
 * Get job results
 * @param {string} jobId
 * @returns {Promise<Object>} Full results object
 */
export async function getJobResults(jobId) {
  const response = await apiClient.get(`/jobs/${jobId}/results`)
  return response.data
}

/**
 * Get URL for downloading the PDF report
 * @param {string} jobId
 * @returns {string}
 */
export function getReportUrl(jobId) {
  return `${BASE_URL}/jobs/${jobId}/report`
}

/**
 * Get URL for downloading the ZIP archive
 * @param {string} jobId
 * @returns {string}
 */
export function getDownloadUrl(jobId) {
  return `${BASE_URL}/jobs/${jobId}/download`
}

/**
 * Get URL for the protein PDB file
 * @param {string} jobId
 * @returns {string}
 */
export function getProteinUrl(jobId) {
  return `${BASE_URL}/jobs/${jobId}/protein`
}

/**
 * Get URL for a specific docking pose PDBQT file
 * @param {string} jobId
 * @param {number} index - Pose index (0-based)
 * @returns {string}
 */
export function getPoseUrl(jobId, index) {
  return `${BASE_URL}/jobs/${jobId}/pose/${index}`
}

/**
 * Check API health
 * @returns {Promise<{status: string}>}
 */
export async function checkHealth() {
  const response = await apiClient.get('/health')
  return response.data
}

/**
 * Get retrosynthesis route for a specific molecule in a job
 * @param {string} jobId
 * @param {number} molIndex - 0-based molecule index in results
 * @returns {Promise<Object>} Synthesis route object
 */
export const getSynthesisRoute = (jobId, molIndex) =>
  apiClient.get(`/jobs/${jobId}/synthesis/${molIndex}`)

/**
 * Start a lead optimization run for a given molecule in a job.
 * @param {string} jobId
 * @param {Object} params - Optimization parameters
 * @param {Object} params.weights - Objective weights (binding_affinity, toxicity, bioavailability, synthesis)
 * @param {number} params.n_iterations - Number of optimization iterations
 * @param {number} params.variants_per_iteration - Variants per iteration
 * @param {string} [params.starting_smiles] - SMILES of the starting molecule
 * @returns {Promise<{opt_id: string}>}
 */
export async function startOptimization(jobId, params) {
  const response = await apiClient.post(`/jobs/${jobId}/optimize`, params)
  return response.data
}

/**
 * Poll the status of a lead optimization run.
 * @param {string} jobId
 * @param {string} optId - Optimization run ID returned by startOptimization
 * @returns {Promise<Object>} Optimization status object with iterations, best_molecule, objectives
 */
export async function getOptimizationStatus(jobId, optId) {
  const response = await apiClient.get(`/jobs/${jobId}/optimization/${optId}`)
  return response.data
}

/**
 * Retrieve the audit log for a job (traceability of all pipeline steps).
 * @param {string} jobId
 * @returns {Promise<Object>} Audit log entries
 */
export async function getAuditLog(jobId) {
  const response = await apiClient.get(`/jobs/${jobId}/audit_log`)
  return response.data
}

export default apiClient
