export interface CloudHealthStatus {
  supabaseSyncOk: boolean;
  supabaseLastSyncAt: number;
  firebaseBackupOk: boolean;
  firebaseLastBackupAt: number;
  firebaseBackupCount: number;
  pendingCloudWrites: number;
}

export const DEFAULT_CLOUD_HEALTH_STATUS: CloudHealthStatus = {
  supabaseSyncOk: true,
  supabaseLastSyncAt: 0,
  firebaseBackupOk: true,
  firebaseLastBackupAt: 0,
  firebaseBackupCount: 0,
  pendingCloudWrites: 0,
};
