import { getAppSettings } from '../../infrastructure/database/models';

export interface AppSettingsResponse {
  signupsEnabled: boolean;
  loginEnabled: boolean;
}

export class AdminService {
  async getSettings(): Promise<AppSettingsResponse> {
    const settings = await getAppSettings();
    return {
      signupsEnabled: settings.signupsEnabled,
      loginEnabled: settings.loginEnabled,
    };
  }

  async updateSettings(
    update: Partial<AppSettingsResponse>
  ): Promise<AppSettingsResponse> {
    const settings = await getAppSettings();

    if (update.signupsEnabled !== undefined) {
      settings.signupsEnabled = update.signupsEnabled;
    }
    if (update.loginEnabled !== undefined) {
      settings.loginEnabled = update.loginEnabled;
    }

    await settings.save();
    return {
      signupsEnabled: settings.signupsEnabled,
      loginEnabled: settings.loginEnabled,
    };
  }
}
