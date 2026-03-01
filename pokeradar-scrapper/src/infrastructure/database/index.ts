// Re-export database utilities from shared
export {
  connectDB,
  disconnectDB,
  setDbLogger,
  getConnectionState,
  isConnected,
} from '@pokeradar/shared';
