/**
 * Single source of truth for all bot and notification message content.
 * Each platform adapter calls the appropriate formatter.
 */

import { INotificationPayload } from '@pokeradar/shared';

// ─── Notification messages ────────────────────────────────────────────────────

function formatPricePL(price: number): string {
  return `${price.toFixed(2).replace('.', ',')} zł`;
}

function buildNotificationLines(payload: INotificationPayload, bold: (s: string) => string): string[] {
  const priceStr = formatPricePL(payload.price);
  const maxPriceStr = formatPricePL(payload.maxPrice);
  const priceLine = payload.price < payload.maxPrice
    ? `🏷️ Cena: ${priceStr} (maks: ${maxPriceStr})`
    : `🏷️ Cena: ${priceStr}`;

  return [
    '🎯 Produkt dostępny!',
    '',
    bold(payload.productName),
    `🛒 Sklep: ${payload.shopName}`,
    priceLine,
    '',
    `[Kup teraz →](${payload.productUrl})`,
  ];
}

export function formatTelegramNotification(payload: INotificationPayload): string {
  return buildNotificationLines(payload, (s) => `*${s}*`).join('\n');
}

export function formatDiscordNotification(payload: INotificationPayload): string {
  return buildNotificationLines(payload, (s) => `**${s}**`).join('\n');
}

// ─── Bot command messages ─────────────────────────────────────────────────────

export interface BotMessages {
  start: string;
  linkSuccess: string;
  linkInvalidToken: string;
  linkUsage: string;
  help: (commandList: string) => string;
}

export function getTelegramMessages(appUrl: string): BotMessages {
  return {
    start: [
      '*Witaj w pokeradar!*',
      '',
      'Monitoruję ceny produktów Pokemon TCG i wysyłam powiadomienia, gdy cena spadnie poniżej ustawionego progu.',
      '',
      'Aby zacząć, połącz swoje konto za pomocą tokenu ze strony:',
      `1. Wejdź na [pokeradar](${appUrl}) i otwórz Ustawienia`,
      '2. Wygeneruj token połączenia',
      '3. Wyślij go tutaj: `/link <token>`',
      '',
      'Użyj /help, aby zobaczyć dostępne komendy.',
    ].join('\n'),

    linkSuccess: `Konto połączone! Od teraz będziesz otrzymywać powiadomienia o cenach.\n\nWróć na [pokeradar](${appUrl}), aby dostosować swoją listę obserwowanych.`,

    linkInvalidToken: `Nieprawidłowy lub wygasły token. Wygeneruj nowy na [pokeradar](${appUrl}).`,

    linkUsage: `Podaj token. Użycie: \`/link <token>\`\n\nWygeneruj go na [pokeradar](${appUrl}).`,

    help: (commandList: string) =>
      [
        '*pokeradar Bot*',
        '',
        'Monitoruję ceny produktów Pokemon TCG i powiadamiam, gdy spadną poniżej ustawionego progu.',
        '',
        '*Dostępne komendy:*',
        commandList,
        '',
        `Zarządzaj swoją listą obserwowanych na [pokeradar](${appUrl}).`,
      ].join('\n'),
  };
}

export function getDiscordMessages(appUrl: string): BotMessages {
  return {
    start: [
      '🎯 **Witaj w pokeradar!**',
      '',
      'Monitoruję ceny produktów Pokemon TCG i wysyłam powiadomienia, gdy cena spadnie poniżej ustawionego progu.',
      '',
      'Aby zacząć, połącz swoje konto za pomocą tokenu ze strony:',
      `1. Wejdź na [pokeradar](${appUrl}) i otwórz Ustawienia`,
      '2. Wygeneruj token połączenia',
      '3. Użyj komendy **/link** i podaj token',
      '',
      'Użyj **/help**, aby zobaczyć dostępne komendy.',
    ].join('\n'),

    linkSuccess: `✅ Konto połączone! Od teraz będziesz otrzymywać powiadomienia o cenach.\n\nWróć na [pokeradar](${appUrl}), aby dostosować swoją listę obserwowanych.`,

    linkInvalidToken: `❌ Nieprawidłowy lub wygasły token. Wygeneruj nowy na [pokeradar](${appUrl}).`,

    linkUsage: `Podaj token jako argument komendy **/link**.\n\nWygeneruj go na [pokeradar](${appUrl}).`,

    help: (commandList: string) =>
      [
        '**pokeradar Bot**',
        '',
        'Monitoruję ceny produktów Pokemon TCG i powiadamiam, gdy spadną poniżej ustawionego progu.',
        '',
        '**Dostępne komendy:**',
        commandList,
        '',
        `Zarządzaj swoją listą obserwowanych na [pokeradar](${appUrl}).`,
      ].join('\n'),
  };
}
