/**
 * Single source of truth for all bot and notification message content.
 * Each platform adapter calls the appropriate formatter.
 */

import { INotificationPayload } from '@pokeradar/shared';

// ─── Notification messages ────────────────────────────────────────────────────

function formatPricePL(price: number): string {
  return `${price.toFixed(2).replace('.', ',')} zł`;
}

function buildNotificationLines(
  payload: INotificationPayload,
  bold: (s: string) => string,
): string[] {
  const priceStr = formatPricePL(payload.price);
  const maxPriceStr = formatPricePL(payload.maxPrice);
  const priceLine =
    payload.price < payload.maxPrice
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

export function botError(text: string): string {
  return `❌ ${text}`;
}

function appLink(appUrl: string, label = 'pokeradar'): string {
  return `[${label}](${appUrl})`;
}

export interface BotMessages {
  start: string;
  linkSuccess: string;
  linkAlreadyLinked: string;
  linkUsedByAnother: string;
  linkInvalidToken: string;
  linkUsage: string;
  /** Short prompt shown with force_reply when /link is sent without a token (Telegram). */
  linkPrompt: string;
  help: (commandList: string) => string;
}

interface BotPlatformConfig {
  bold: (s: string) => string;
  platformName: string;
}

function buildBotMessages(appUrl: string, config: BotPlatformConfig): BotMessages {
  const { bold } = config;
  const link = appLink(appUrl);
  return {
    start: [
      `🎯 ${bold('Witaj w pokeradar!')}`,
      '',
      'Monitoruję ceny produktów Pokemon TCG i wysyłam powiadomienia, gdy cena spadnie poniżej ustawionego progu.',
      '',
      'Aby zacząć, połącz swoje konto za pomocą tokenu ze strony:',
      `1. Wejdź na ${link} i otwórz Ustawienia`,
      '2. Wygeneruj token połączenia',
      `3. Użyj komendy ${bold('/link')} i podaj token`,
      '',
      `Użyj ${bold('/help')}, aby zobaczyć dostępne komendy.`,
    ].join('\n'),

    linkSuccess: `✅ Konto połączone! Od teraz będziesz otrzymywać powiadomienia o cenach.\n\nWróć na ${link}, aby dostosować swoją listę obserwowanych.`,

    linkAlreadyLinked: botError(
      `Twoje konto ${config.platformName} jest już połączone z pokeradar.`,
    ),

    linkUsedByAnother: botError(
      `To konto ${config.platformName} jest już połączone z innym kontem pokeradar. Każde konto ${config.platformName} może być połączone tylko z jednym kontem pokeradar.`,
    ),

    linkInvalidToken: botError(`Nieprawidłowy lub wygasły token. Wygeneruj nowy na ${link}.`),

    linkUsage: `Podaj token. Użycie: ${bold('/link')} <token>\n\nWygeneruj go na ${link}.`,

    linkPrompt: `Podaj token połączenia ze strony ${link}:`,

    help: (commandList: string) =>
      [
        bold('pokeradar bot'),
        '',
        'Monitoruję ceny produktów Pokemon TCG i powiadamiam, gdy spadną poniżej ustawionego progu.',
        '',
        bold('Dostępne komendy:'),
        commandList,
        '',
        `Zarządzaj swoją listą obserwowanych na ${link}.`,
      ].join('\n'),
  };
}

export function getTelegramMessages(appUrl: string): BotMessages {
  return buildBotMessages(appUrl, {
    bold: (s) => `*${s}*`,
    platformName: 'Telegram',
  });
}

export function getDiscordMessages(appUrl: string): BotMessages {
  return buildBotMessages(appUrl, {
    bold: (s) => `**${s}**`,
    platformName: 'Discord',
  });
}
