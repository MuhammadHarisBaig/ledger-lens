// Worker endpoint that QStash will POST each job to. The route itself arrives in 3C;
// 3B only needs the path to address the published message.
export const WORKER_PATH = "/api/worker/process";
