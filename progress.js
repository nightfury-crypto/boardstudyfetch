// progress.js

const jobs = new Map();

/**
 * Create a new job
 */
export function createJob(jobId) {
    jobs.set(jobId, {
        status: "Waiting...",
        current: 0,
        total: 0,
        percentage: 0,
        completed: false,
        error: null,
        pdfPath: null
    });
}

/**
 * Update progress
 */
export function updateJob(jobId, data) {
    const job = jobs.get(jobId);

    if (!job) return;

    Object.assign(job, data);

    if (job.total > 0) {
        job.percentage = Math.round(
            (job.current / job.total) * 100
        );
    }
}

/**
 * Mark job completed
 */
export function completeJob(jobId, pdfPath = null) {
    const job = jobs.get(jobId);

    if (!job) return;

    job.completed = true;
    job.percentage = 100;
    job.status = "Completed";
    job.pdfPath = pdfPath;
}

/**
 * Mark job failed
 */
export function failJob(jobId, error) {
    const job = jobs.get(jobId);

    if (!job) return;

    job.completed = true;
    job.error = error;
    job.status = "Failed";
}

/**
 * Get job info
 */
export function getJob(jobId) {
    return jobs.get(jobId);
}

/**
 * Delete job
 */
export function deleteJob(jobId) {
    jobs.delete(jobId);
}