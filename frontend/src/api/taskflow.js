const API_BASE = "/api";

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,

        headers: {
            ...(options.body
                ? {
                    "Content-Type": "application/json",
                }
                : {}),

            ...options.headers,
        },
    });

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            text || `Request failed with status ${response.status}`,
        );
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export function getWorkloads() {
    return request("/workloads");
}

export function getWorkload(id) {
    return request(`/workloads/${id}`);
}

export function getWorkloadJobs(id) {
    return request(`/workloads/${id}/jobs`);
}

export function createWorkload(workload) {
    return request("/workloads", {
        method: "POST",
        body: JSON.stringify(workload),
    });
}

/*
 * The backend currently creates one workload per request.
 *
 * The frontend can still submit several workloads together
 * by sending those independent requests concurrently.
 */
export async function createMultipleWorkloads(
    workloads,
) {
    return Promise.allSettled(
        workloads.map((workload) =>
            createWorkload(workload),
        ),
    );
}