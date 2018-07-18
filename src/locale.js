// locale.js
// Locale-specific fixes & stuff.

export var DEFAULT_LOCALE = "en-US";

export function upper(string, locale) {
  return string.toLocaleUpperCase(locale);
}

export function lower(string, locale) {
  return string.toLocaleLowerCase(locale);
}
