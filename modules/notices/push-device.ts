export type DeviceOs =
  "ios" | "android" | "windows" | "macos" | "linux" | "chromeos" | "unknown"
export type DeviceBrowser =
  | "chrome"
  | "firefox"
  | "safari"
  | "edge"
  | "samsung"
  | "opera"
  | "in-app"
  | "unknown"
export type PushDevice = {
  os: DeviceOs
  browser: DeviceBrowser
  kind: "phone" | "tablet" | "desktop" | "unknown"
  installed: boolean
}
export type DeviceSignals = {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
  standalone?: boolean
  displayModeStandalone?: boolean
}

export function detectPushDevice(signals: DeviceSignals): PushDevice {
  const ua = signals.userAgent
  const ipad =
    /iPad/i.test(ua) ||
    ((signals.platform === "MacIntel" || /Macintosh/.test(ua)) &&
      (signals.maxTouchPoints ?? 0) > 1)
  const os: DeviceOs =
    /iPhone|iPod/i.test(ua) || ipad
      ? "ios"
      : /Android/i.test(ua)
        ? "android"
        : /Windows/i.test(ua)
          ? "windows"
          : /Macintosh|Mac OS X/i.test(ua)
            ? "macos"
            : /CrOS/i.test(ua)
              ? "chromeos"
              : /Linux/i.test(ua)
                ? "linux"
                : "unknown"
  const browser: DeviceBrowser = /FBAN|FBAV|Instagram|; wv\)|Line\//i.test(ua)
    ? "in-app"
    : /EdgA?\/|EdgiOS\//i.test(ua)
      ? "edge"
      : /OPR\/|OPiOS\/|Opera/i.test(ua)
        ? "opera"
        : /SamsungBrowser\//i.test(ua)
          ? "samsung"
          : /Firefox\/|FxiOS\//i.test(ua)
            ? "firefox"
            : /Chrome\/|CriOS\//i.test(ua)
              ? "chrome"
              : /Safari\//i.test(ua)
                ? "safari"
                : "unknown"
  const kind =
    ipad || (os === "android" && !/Mobile/i.test(ua))
      ? "tablet"
      : os === "ios" || os === "android"
        ? "phone"
        : os !== "unknown"
          ? "desktop"
          : "unknown"
  return {
    os,
    browser,
    kind,
    installed: Boolean(signals.standalone || signals.displayModeStandalone),
  }
}

const OS_LABELS = {
  ios: "iPhone/iPad",
  android: "Android",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  chromeos: "ChromeOS",
  unknown: "Sistema não identificado",
}
const BROWSER_LABELS = {
  chrome: "Chrome",
  firefox: "Firefox",
  safari: "Safari",
  edge: "Edge",
  samsung: "Samsung Internet",
  opera: "Opera",
  "in-app": "Navegador de outro aplicativo",
  unknown: "Navegador não identificado",
}
export function pushDeviceLabel(device: PushDevice) {
  const os =
    device.os === "ios"
      ? device.kind === "tablet"
        ? "iPad"
        : "iPhone"
      : OS_LABELS[device.os]
  return `${os} · ${device.installed ? "App instalado" : BROWSER_LABELS[device.browser]}`
}

export type DeviceGuidance = {
  title: string
  description: string
  steps: string[]
  helpUrl?: string
}
export function getPushDeviceGuidance(
  device: PushDevice,
  blocked = false
): DeviceGuidance {
  if (blocked)
    return {
      title: "Permita as notificações nas configurações",
      description:
        device.installed && device.os === "ios"
          ? "Abra os Ajustes do iPhone ou iPad e procure as notificações da Pokédex."
          : "Abra as permissões deste site no navegador e altere Notificações para Permitir. Se necessário, confira também as permissões do navegador no sistema.",
      steps: [
        "Depois de ajustar a permissão, volte à Pokédex e tente ativar novamente.",
      ],
    }
  if (device.installed)
    return {
      title: "Você já está usando a Pokédex como app",
      description:
        "A etapa de adicionar à tela inicial já foi feita. Use o botão de ativação de notificações quando ele estiver disponível.",
      steps: [],
    }
  if (device.browser === "in-app")
    return {
      title: "Abra em um navegador",
      description:
        "Este endereço foi aberto dentro de outro aplicativo. Use a opção de abrir no navegador para configurar as notificações.",
      steps: [
        device.os === "ios"
          ? "Abra no Safari e adicione a Pokédex à Tela de Início."
          : "Abra no Chrome ou Firefox e volte ao Perfil → Notificações.",
      ],
    }
  if (device.os === "ios") {
    const safari = device.browser === "safari" || device.browser === "unknown"
    const chrome = device.browser === "chrome"
    return {
      title: "Adicione a Pokédex à Tela de Início",
      description: `No ${device.kind === "tablet" ? "iPad" : "iPhone"}, abra a Pokédex pelo ícone instalado para receber notificações.`,
      steps: [
        safari
          ? "No Safari, abra Compartilhar pela barra de endereço ou pelo menu da página."
          : chrome
            ? "No Chrome, abra as opções de compartilhamento da página."
            : "Abra este mesmo endereço no Safari e toque em Compartilhar.",
        "Escolha Adicionar à Tela de Início. Se houver a opção Abrir como App da Web, deixe-a ativada.",
        "Confirme a adição e abra a Pokédex pelo novo ícone na Tela de Início.",
        "Entre na sua conta e volte ao Perfil → Notificações para ativar os avisos.",
      ],
      helpUrl:
        safari || !chrome
          ? "https://support.apple.com/pt-br/guide/iphone/iphea86e5236/ios"
          : "https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DiOS&hl=pt-BR",
    }
  }
  if (device.os === "android")
    return {
      title: "Tenha a Pokédex na tela inicial",
      description:
        "No Android, adicionar o app facilita o acesso. Se o botão de notificações já estiver disponível, você também pode ativá-las pelo navegador.",
      steps: [
        device.browser === "firefox"
          ? "No Firefox, abra o menu e procure Adicionar à tela inicial ou Instalar."
          : device.browser === "chrome"
            ? "No Chrome, abra o menu de três pontos e procure Instalar e criar atalho ou Adicionar à tela inicial."
            : "Abra o menu do navegador e procure Instalar aplicativo ou Adicionar à tela inicial. Se não encontrar, tente pelo Chrome ou Firefox.",
        "Confirme a instalação ou a criação do atalho, conforme a opção disponível.",
        "Abra pelo ícone e volte ao Perfil → Notificações para configurar os avisos.",
      ],
      helpUrl:
        device.browser === "firefox"
          ? "https://support.mozilla.org/en-US/kb/how-add-shortcut-website-android"
          : device.browser === "chrome"
            ? "https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=pt-BR"
            : undefined,
    }
  if (device.kind === "desktop")
    return {
      title: "Notificações no computador",
      description: `Você está acessando pelo ${BROWSER_LABELS[device.browser]}. Use o botão abaixo para permitir notificações neste navegador; não é necessário adicionar à tela inicial.`,
      steps: [],
    }
  return {
    title: "Configure neste dispositivo",
    description:
      "Não foi possível identificar com segurança seu sistema. Você pode usar o botão de ativação quando disponível. No celular, procure a opção de adicionar à tela inicial no menu do navegador.",
    steps: [],
  }
}
