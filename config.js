/*
  AMANDATUR ORCAMENTOS - CONFIGURACAO CENTRAL
  Edite este arquivo para mudar valores, integracoes e comportamento do site.
*/

window.AMANDATUR_CONFIG = {
  brand: {
    companyName: "AMANDATUR",
    subtitle: "Orcamentos inteligentes",
    whatsappNumber: "5544998224499",
    instagramUrl: "https://www.instagram.com/amandatur_turismo/",
    primaryRouteLabel: "Fretamentos, excursões e viagens de grupo",

    /*
      heroImageUrl: URL de uma imagem personalizada para o painel visual do hero (seção direita da tela inicial).
      A imagem fica como fundo atrás dos cards de KM e orçamento.
      Deixe vazio "" para usar o fundo escuro padrão.
      Exemplo: "https://i.imgur.com/SuaImagem.jpg"
      Ou use um caminho relativo: "assets/hero-bg.jpg"
    */
    heroImageUrl: ""
  },

  pricing: {
    currency: "BRL",
    defaultRatePerKm: 7.5,
    minimumPrice: 1800,
    stopFee: 80,
    driverDailyFee: 350,
    tollsDefault: 0,
    parkingDefault: 0,
    foodDefault: 0,
    lodgingDefault: 0,
    otherCostsDefault: 0,
    safetyMarginPercent: 15,
    discountDefault: 0,
    extraKmDefault: 0,
    passengersDefault: 40,
    estimatedHoursDefault: 8
  },

  calculation: {
    /*
      Tipo de trajeto padrão ao abrir o sistema.
      Opções: "round" | "oneway" | "return_only" | "excursion" | "multi_leg"
    */
    defaultTripMode: "round",

    minimumPriceEnabled: true,
    allowManualKmOverride: true,
    autoRecalculateDelayMs: 650,
    quotePrefix: "AMANDATUR"
  },

  /*
    ROUTING_PROVIDER:
    - "google": profissional, recomendado para uso real. Requer GOOGLE_MAPS_API_KEY.
    - "osrm": fallback para teste sem chave, usando OpenStreetMap/Nominatim + OSRM publico.

    Para projeto comercial definitivo, use Google Maps com chave restringida por dominio.
  */
  maps: {
    routingProvider: "osrm",
    googleMapsApiKey: "",
    googleLibraries: "places",
    countryBias: "br",
    osrmRouteUrl: "https://router.project-osrm.org/route/v1/driving",
    nominatimSearchUrl: "https://nominatim.openstreetmap.org/search",
    defaultCenter: {
      lat: -23.6634,
      lng: -52.6057
    }
  },

  /*
    INTEGRACOES: configuradas aqui internamente, não aparecem na interface visual.
    Para ativar, preencha as URLs e mude os valores para true.
  */
  integrations: {
    googleAppsScriptUrl: "",
    n8nWebhookUrl: "",
    sendToAppsScript: false,
    sendToN8n: false,
    appsScriptRequestMode: "no-cors",
    n8nRequestMode: "cors"
  },

  tracking: {
    googleTagManagerId: "",
    metaPixelId: "",
    enableTracking: false
  },

  fields: {
    requireClientName: true,
    requirePhone: true,
    requireOrigin: true,
    requireDestination: true,
    requireDate: true,
    requirePassengers: true,
    requireRouteDistance: true
  },

  vehicles: [
    { id: "executivo", label: "Ônibus Executivo", capacity: 46, multiplier: 1 },
    { id: "double-decker", label: "Ônibus Double Decker", capacity: 54, multiplier: 1.18 },
    { id: "micro", label: "Micro-ônibus", capacity: 28, multiplier: 0.78 },
    { id: "van", label: "Van", capacity: 15, multiplier: 0.52 }
  ],

  whatsapp: {
    messageTitle: "ORÇAMENTO AMANDATUR",
    disclaimer: "Este orçamento é uma estimativa e pode ser ajustado após confirmação de rota, pedágios, horários, disponibilidade e regras de circulação."
  }
};
