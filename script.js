(function () {
  "use strict";

  const CONFIG = window.AMANDATUR_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: CONFIG.pricing?.currency || "BRL"
  });
  const number = new Intl.NumberFormat("pt-BR");
  const historyKey = "amandatur_orcamentos_html_v2";
  const draftKey = "amandatur_orcamentos_draft_v2";

  // ─── Mapa de tipos de trajeto ────────────────────────────────────────────────
  const TRIP_MODES = {
    round: {
      label: "Ida e volta",
      emoji: "🔄",
      multiplier: 2,
      description: "KM calculado × 2 (viagem de ida + retorno completo)"
    },
    oneway: {
      label: "Somente ida",
      emoji: "➡️",
      multiplier: 1,
      description: "KM calculado apenas para o trecho de ida"
    },
    return_only: {
      label: "Somente volta",
      emoji: "⬅️",
      multiplier: 1,
      description: "KM calculado apenas para o trecho de retorno"
    },
    excursion: {
      label: "Excursão (circular)",
      emoji: "🔁",
      multiplier: 1,
      description: "Trajeto circular — o KM informado já contempla o retorno"
    },
    multi_leg: {
      label: "Trajeto múltiplo / frete",
      emoji: "🗺️",
      multiplier: 1,
      description: "Frete com múltiplas paradas — use o KM total do percurso completo"
    }
  };

  const state = {
    routeProviderReady: false,
    google: {
      directionsService: null,
      autocompleteOrigin: null,
      autocompleteDestination: null
    },
    route: {
      provider: CONFIG.maps?.routingProvider || "osrm",
      distanceKm: 0,
      durationHours: 0,
      origin: "",
      destination: "",
      stops: [],
      source: "manual"
    },
    timers: {}
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    applyConfigDefaults();
    populateVehicles();
    installTracking();
    applyHeroImage();
    bindEvents();
    restoreDraft();
    updateAll();
    renderHistory();
    initRouteProvider();
  }

  function cacheElements() {
    [
      "quoteForm", "clientName", "clientPhone", "tripDate", "departureTime",
      "passengers", "vehicleType", "origin", "destination", "stopsText",
      "tripMode", "extraKm", "routeKm", "estimatedHours", "ratePerKm",
      "minimumPrice", "stopFee", "driverFee", "tolls", "parking", "food",
      "lodging", "otherCosts", "marginPercent", "discount", "companyWhatsapp",
      "appsScriptUrl", "n8nWebhookUrl", "sendAppsScript", "sendN8n", "notes",
      "calculateRouteBtn", "useManualKmBtn", "routeStatus", "totalValue",
      "resultNote", "kmTotal", "kmPrice", "extrasTotal", "marginValue",
      "baseValue", "quotePreview", "whatsappBtn", "saveQuoteBtn", "copyQuoteBtn",
      "clearFormBtn", "clearHistoryBtn", "historyList", "toast", "heroKm",
      "heroTotal", "heroBgImage"
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function applyConfigDefaults() {
    const pricing = CONFIG.pricing || {};
    const integrations = CONFIG.integrations || {};
    const brand = CONFIG.brand || {};
    const calc = CONFIG.calculation || {};

    setValue("passengers", pricing.passengersDefault ?? 40);
    setValue("extraKm", pricing.extraKmDefault ?? 0);
    setValue("routeKm", 0);
    setValue("estimatedHours", pricing.estimatedHoursDefault ?? 8);
    setValue("ratePerKm", pricing.defaultRatePerKm ?? 7.5);
    setValue("minimumPrice", pricing.minimumPrice ?? 1800);
    setValue("stopFee", pricing.stopFee ?? 80);
    setValue("driverFee", pricing.driverDailyFee ?? 350);
    setValue("tolls", pricing.tollsDefault ?? 0);
    setValue("parking", pricing.parkingDefault ?? 0);
    setValue("food", pricing.foodDefault ?? 0);
    setValue("lodging", pricing.lodgingDefault ?? 0);
    setValue("otherCosts", pricing.otherCostsDefault ?? 0);
    setValue("marginPercent", pricing.safetyMarginPercent ?? 15);
    setValue("discount", pricing.discountDefault ?? 0);
    setValue("companyWhatsapp", brand.whatsappNumber || "5544998224499");

    // Integrações carregadas silenciosamente do config (sem exibir para o usuário)
    setValue("appsScriptUrl", integrations.googleAppsScriptUrl || "");
    setValue("n8nWebhookUrl", integrations.n8nWebhookUrl || "");

    if (elements.tripMode) {
      elements.tripMode.value = calc.defaultTripMode || "round";
    }
    if (elements.sendAppsScript) elements.sendAppsScript.checked = Boolean(integrations.sendToAppsScript);
    if (elements.sendN8n) elements.sendN8n.checked = Boolean(integrations.sendToN8n);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    if (elements.tripDate) elements.tripDate.min = yyyy + "-" + mm + "-" + dd;
  }

  function populateVehicles() {
    if (!elements.vehicleType) return;
    const vehicles = CONFIG.vehicles || [];
    elements.vehicleType.innerHTML = vehicles.map((vehicle) => {
      return `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(vehicle.label)} · ${vehicle.capacity} lugares</option>`;
    }).join("");
  }

  // ─── Imagem personalizada no hero panel ─────────────────────────────────────
  function applyHeroImage() {
    const imageUrl = CONFIG.brand?.heroImageUrl;
    if (!imageUrl || !elements.heroBgImage) return;
    elements.heroBgImage.style.backgroundImage = `url(${JSON.stringify(imageUrl)})`;
    elements.heroBgImage.classList.add("active");
  }

  function bindEvents() {
    const inputs = document.querySelectorAll("input, select, textarea");
    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        scheduleDraftSave();
        updateAll();
        if (["origin", "destination", "stopsText", "tripMode"].includes(input.id)) {
          scheduleRouteCalculation();
        }
      });
      input.addEventListener("change", () => {
        scheduleDraftSave();
        updateAll();
      });
    });

    elements.calculateRouteBtn?.addEventListener("click", calculateRouteNow);
    elements.useManualKmBtn?.addEventListener("click", useManualKm);
    elements.whatsappBtn?.addEventListener("click", openWhatsApp);
    elements.copyQuoteBtn?.addEventListener("click", copyQuote);
    elements.saveQuoteBtn?.addEventListener("click", saveQuote);
    elements.clearFormBtn?.addEventListener("click", clearForm);
    elements.clearHistoryBtn?.addEventListener("click", clearHistory);
  }

  function installTracking() {
    const tracking = CONFIG.tracking || {};
    if (!tracking.enableTracking) return;

    if (tracking.googleTagManagerId) {
      injectGtm(tracking.googleTagManagerId);
    }

    if (tracking.metaPixelId) {
      injectMetaPixel(tracking.metaPixelId);
    }

    document.body.classList.add("tracking-ready");
  }

  function injectGtm(id) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js"
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(id);
    document.head.appendChild(script);
  }

  function injectMetaPixel(id) {
    if (window.fbq) return;
    window.fbq = function () {
      window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments);
    };
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = "2.0";
    window.fbq.queue = [];

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);

    window.fbq("init", id);
    window.fbq("track", "PageView");
  }

  function trackEvent(name, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...(data || {}) });

    if (window.fbq) {
      window.fbq("trackCustom", name, data || {});
    }
  }

  function initRouteProvider() {
    const provider = CONFIG.maps?.routingProvider || "osrm";
    state.route.provider = provider;

    if (provider === "google" && CONFIG.maps?.googleMapsApiKey) {
      loadGoogleMaps();
      return;
    }

    if (provider === "google" && !CONFIG.maps?.googleMapsApiKey) {
      setRouteStatus("Google Maps selecionado, mas a chave não foi preenchida. Usando OSRM como fallback.", "error");
      state.route.provider = "osrm";
      return;
    }

    setRouteStatus("Modo OSRM ativo. Para uso comercial definitivo, configure Google Maps no config.js.", "");
  }

  function loadGoogleMaps() {
    if (window.google?.maps) {
      setupGoogleMaps();
      return;
    }

    window.__amandaturGoogleReady = setupGoogleMaps;
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(CONFIG.maps.googleMapsApiKey) +
      "&libraries=" + encodeURIComponent(CONFIG.maps.googleLibraries || "places") +
      "&callback=__amandaturGoogleReady";
    script.onerror = () => {
      state.route.provider = "osrm";
      setRouteStatus("Google Maps não carregou. Usando OSRM como fallback.", "error");
    };
    document.head.appendChild(script);
  }

  function setupGoogleMaps() {
    state.routeProviderReady = true;
    state.google.directionsService = new google.maps.DirectionsService();

    const options = {
      fields: ["formatted_address", "geometry", "name"],
      componentRestrictions: CONFIG.maps?.countryBias ? { country: CONFIG.maps.countryBias } : undefined
    };

    if (google.maps.places?.Autocomplete) {
      state.google.autocompleteOrigin = new google.maps.places.Autocomplete(elements.origin, options);
      state.google.autocompleteDestination = new google.maps.places.Autocomplete(elements.destination, options);
    }

    setRouteStatus("Google Maps ativo. Digite origem e destino para calcular KM real.", "ok");
  }

  function scheduleRouteCalculation() {
    clearTimeout(state.timers.route);
    const delay = CONFIG.calculation?.autoRecalculateDelayMs ?? 650;
    state.timers.route = setTimeout(() => {
      const origin = value("origin");
      const destination = value("destination");
      if (origin.length > 3 && destination.length > 3) {
        calculateRouteNow();
      }
    }, delay);
  }

  async function calculateRouteNow() {
    const origin = value("origin");
    const destination = value("destination");
    const stops = parseStops();

    if (!origin || !destination) {
      setRouteStatus("Preencha origem e destino para calcular a quilometragem.", "error");
      return;
    }

    setRouteStatus("Calculando rota em tempo real...", "");

    try {
      const result = state.route.provider === "google"
        ? await calculateGoogleRoute(origin, destination, stops)
        : await calculateOsrmRoute(origin, destination, stops);

      state.route = {
        ...state.route,
        ...result,
        origin,
        destination,
        stops,
        source: result.provider
      };

      setValue("routeKm", Math.round(result.distanceKm));
      setValue("estimatedHours", round(result.durationHours, 1));

      const tripInfo = getTripModeInfo();
      const totalKmDisplay = number.format(Math.round(result.distanceKm * tripInfo.multiplier));
      setRouteStatus(
        `Rota calculada por ${result.providerLabel}: ${number.format(Math.round(result.distanceKm))} km (ida) · ${totalKmDisplay} km total (${tripInfo.label}) · ${round(result.durationHours, 1)}h estimadas.`,
        "ok"
      );
      trackEvent("RouteCalculated", {
        provider: result.provider,
        distance_km: result.distanceKm,
        duration_hours: result.durationHours
      });
      updateAll();
    } catch (error) {
      console.error(error);
      setRouteStatus("Não foi possível calcular automaticamente. Use o KM manual ou revise origem/destino.", "error");
    }
  }

  function calculateGoogleRoute(origin, destination, stops) {
    return new Promise((resolve, reject) => {
      if (!state.google.directionsService) {
        reject(new Error("Google DirectionsService indisponivel."));
        return;
      }

      const waypoints = stops.map((stop) => ({
        location: stop,
        stopover: true
      }));

      state.google.directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
        provideRouteAlternatives: false
      }, (response, status) => {
        if (status !== "OK" || !response?.routes?.[0]) {
          reject(new Error("Google route failed: " + status));
          return;
        }

        const legs = response.routes[0].legs || [];
        const meters = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
        const seconds = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);

        resolve({
          provider: "google",
          providerLabel: "Google Maps",
          distanceKm: meters / 1000,
          durationHours: seconds / 3600
        });
      });
    });
  }

  async function calculateOsrmRoute(origin, destination, stops) {
    const points = [origin, ...stops, destination];
    const geocoded = [];

    for (const place of points) {
      const location = await geocodeWithNominatim(place);
      geocoded.push(location);
    }

    const coordinates = geocoded.map((point) => `${point.lng},${point.lat}`).join(";");
    const url = `${CONFIG.maps.osrmRouteUrl}/${coordinates}?overview=false&alternatives=false&steps=false`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("OSRM HTTP " + response.status);
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route) {
      throw new Error("OSRM sem rota.");
    }

    return {
      provider: "osrm",
      providerLabel: "OSRM/OpenStreetMap",
      distanceKm: route.distance / 1000,
      durationHours: route.duration / 3600
    };
  }

  async function geocodeWithNominatim(query) {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      addressdetails: "0"
    });

    if (CONFIG.maps?.countryBias) {
      params.set("countrycodes", CONFIG.maps.countryBias);
    }

    const response = await fetch(`${CONFIG.maps.nominatimSearchUrl}?${params.toString()}`, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Nominatim HTTP " + response.status);
    }

    const data = await response.json();
    const first = data[0];

    if (!first) {
      throw new Error("Endereco nao encontrado: " + query);
    }

    return {
      lat: Number(first.lat),
      lng: Number(first.lon)
    };
  }

  function useManualKm() {
    setRouteStatus("KM manual ativado. Edite o campo 'KM calculado pela rota'.", "ok");
    elements.routeKm.focus();
  }

  // ─── Lógica de multiplicador por tipo de trajeto ─────────────────────────────
  function getTripModeInfo() {
    const mode = value("tripMode") || "round";
    return TRIP_MODES[mode] || TRIP_MODES.round;
  }

  function calculateBudget() {
    const routeKm = numeric("routeKm");
    const extraKm = numeric("extraKm");
    const tripInfo = getTripModeInfo();
    const vehicle = getVehicle();

    const totalKm = Math.max(0, (routeKm * tripInfo.multiplier) + extraKm);
    const adjustedRate = numeric("ratePerKm") * (vehicle?.multiplier || 1);
    const baseValue = totalKm * adjustedRate;
    const stopsCount = parseStops().length;
    const stopsValue = stopsCount * numeric("stopFee");
    const extrasValue = stopsValue + numeric("driverFee") + numeric("tolls") + numeric("parking") + numeric("food") + numeric("lodging") + numeric("otherCosts");
    const beforeMargin = baseValue + extrasValue;
    const marginValue = beforeMargin * (numeric("marginPercent") / 100);
    const rawTotal = beforeMargin + marginValue - numeric("discount");
    const minimum = CONFIG.calculation?.minimumPriceEnabled === false ? 0 : numeric("minimumPrice");
    const totalValue = Math.max(minimum, rawTotal);

    return {
      totalKm,
      adjustedRate,
      baseValue,
      stopsValue,
      extrasValue,
      marginValue,
      rawTotal,
      totalValue,
      minimumApplied: totalValue === minimum && rawTotal < minimum,
      stopsCount,
      vehicle,
      tripInfo
    };
  }

  function updateAll() {
    const budget = calculateBudget();
    const quote = buildQuotePayload(budget);

    textContent("totalValue", money.format(budget.totalValue));
    textContent("heroTotal", money.format(budget.totalValue));
    textContent("kmTotal", number.format(Math.round(budget.totalKm)) + " km");
    textContent("heroKm", budget.totalKm > 0 ? number.format(Math.round(budget.totalKm)) + " km" : "Aguardando rota");
    textContent("kmPrice", money.format(budget.adjustedRate));
    textContent("extrasTotal", money.format(budget.extrasValue));
    textContent("marginValue", money.format(budget.marginValue));
    textContent("baseValue", money.format(budget.baseValue));
    textContent("resultNote", budget.minimumApplied ? "Valor mínimo aplicado para manter segurança comercial." : "Estimativa calculada com rota, extras e margem.");
    textContent("quotePreview", buildWhatsAppMessage(quote));
  }

  function buildQuotePayload(budget = calculateBudget()) {
    const tripInfo = budget.tripInfo || getTripModeInfo();
    return {
      quote_id: nextQuoteId(),
      created_at: new Date().toISOString(),
      company: CONFIG.brand?.companyName || "AMANDATUR",
      client_name: value("clientName"),
      client_phone: onlyNumbers(value("clientPhone")),
      origin: value("origin"),
      destination: value("destination"),
      stops: parseStops(),
      trip_date: value("tripDate"),
      departure_time: value("departureTime"),
      passengers: numeric("passengers"),
      vehicle_type: elements.vehicleType?.selectedOptions?.[0]?.textContent || "",
      trip_mode: value("tripMode"),
      trip_mode_label: tripInfo.label,
      trip_mode_emoji: tripInfo.emoji,
      route_provider: state.route.source,
      route_km_one_way: numeric("routeKm"),
      total_km: budget.totalKm,
      estimated_hours: numeric("estimatedHours"),
      rate_per_km: numeric("ratePerKm"),
      adjusted_rate_per_km: budget.adjustedRate,
      minimum_price: numeric("minimumPrice"),
      stop_fee: numeric("stopFee"),
      driver_fee: numeric("driverFee"),
      tolls: numeric("tolls"),
      parking: numeric("parking"),
      food: numeric("food"),
      lodging: numeric("lodging"),
      other_costs: numeric("otherCosts"),
      margin_percent: numeric("marginPercent"),
      margin_value: budget.marginValue,
      discount: numeric("discount"),
      base_value: budget.baseValue,
      extras_value: budget.extrasValue,
      total_value: budget.totalValue,
      notes: value("notes"),
      status: "ORCAMENTO_GERADO",
      source: "Site AmandaTur Orcamentos"
    };
  }

  // ─── Mensagem do orçamento — reformulada, profissional e clara ───────────────
  function buildWhatsAppMessage(payload) {
    const SEP = "━━━━━━━━━━━━━━━━━━━━━━━━";
    const SEP_THIN = "────────────────────────";
    const title = CONFIG.whatsapp?.messageTitle || "ORÇAMENTO AMANDATUR";

    const hasStops = payload.stops && payload.stops.length > 0;
    const hasNotes = payload.notes && payload.notes.trim();
    const hasDiscount = (payload.discount || 0) > 0;
    const hasExtras = (payload.extras_value || 0) > 0;
    const tripEmoji = payload.trip_mode_emoji || "🔄";
    const tripLabel = payload.trip_mode_label || "Ida e volta";

    // Formata telefone
    const phone = payload.client_phone
      ? formatPhoneBR(payload.client_phone)
      : "A informar";

    const lines = [
      `🚌 *${title}* — #${payload.quote_id}`,
      SEP,
      "",
      `👤 *CLIENTE*`,
      `• Nome: ${payload.client_name || "A informar"}`,
      `• WhatsApp: ${phone}`,
      "",
      `📍 *TRAJETO*`,
      `• Origem: ${payload.origin || "A informar"}`,
      `• Destino: ${payload.destination || "A informar"}`,
      hasStops
        ? `• Paradas: ${payload.stops.join(" → ")}`
        : `• Paradas: Sem paradas`,
      `• Tipo: ${tripEmoji} ${tripLabel}`,
      "",
      `📅 *DETALHES DA VIAGEM*`,
      `• Data: ${formatDateBR(payload.trip_date)}`,
      `• Saída: ${payload.departure_time || "A definir"}`,
      `• Passageiros: ${payload.passengers || "A informar"}`,
      `• Veículo: ${payload.vehicle_type || "A informar"}`,
      "",
      `📏 *QUILOMETRAGEM*`,
      `• Rota (um trecho): ${number.format(Math.round(payload.route_km_one_way || 0))} km`,
      `• Total calculado: ${number.format(Math.round(payload.total_km || 0))} km`,
      `• Tempo estimado: ${number.format(payload.estimated_hours || 0)}h`,
      "",
      SEP_THIN,
      `💰 *COMPOSIÇÃO DO VALOR*`,
      SEP_THIN,
      `• Valor por KM: ${money.format(payload.adjusted_rate_per_km || 0)}`,
      `• Base KM (${number.format(Math.round(payload.total_km || 0))} km): ${money.format(payload.base_value || 0)}`
    ];

    // Adiciona extras individuais com valor apenas se > 0
    const extraItems = [
      { key: "stop_fee", label: "Taxa de paradas", count: payload.stops?.length },
      { key: "driver_fee", label: "Motorista/diária" },
      { key: "tolls", label: "Pedágios" },
      { key: "parking", label: "Estacionamento/taxas" },
      { key: "food", label: "Alimentação/apoio" },
      { key: "lodging", label: "Hospedagem" },
      { key: "other_costs", label: "Outros custos" }
    ];

    if (hasExtras) {
      extraItems.forEach(({ key, label, count }) => {
        const val = payload[key] || 0;
        if (val > 0) {
          const countLabel = count > 0 ? ` (×${count})` : "";
          lines.push(`• ${label}${countLabel}: ${money.format(val)}`);
        }
      });
    }

    lines.push(`• Margem de segurança (${payload.margin_percent || 0}%): ${money.format(payload.margin_value || 0)}`);

    if (hasDiscount) {
      lines.push(`• Desconto aplicado: − ${money.format(payload.discount || 0)}`);
    }

    lines.push(
      SEP,
      `💵 *TOTAL ESTIMADO: ${money.format(payload.total_value || 0)}*`,
      SEP
    );

    if (hasNotes) {
      lines.push(
        "",
        `📝 *OBSERVAÇÕES*`,
        `${payload.notes.trim()}`
      );
    }

    lines.push(
      "",
      `⚠️ _${CONFIG.whatsapp?.disclaimer || "Orçamento sujeito a confirmação."}_`,
      "",
      `AmandaTur • Fretamentos & Excursões 🚌`
    );

    return lines.join("\n");
  }

  async function saveQuote() {
    const validation = validateRequiredFields();
    if (!validation.valid) {
      showToast(validation.message, true);
      return;
    }

    const payload = buildQuotePayload();
    const history = readHistory();
    writeHistory([payload, ...history].slice(0, 12));
    renderHistory();
    trackEvent("QuoteSaved", {
      value: payload.total_value,
      currency: CONFIG.pricing?.currency || "BRL",
      distance_km: payload.total_km
    });

    const tasks = [];

    if (elements.sendAppsScript?.checked && value("appsScriptUrl")) {
      tasks.push(sendIntegration(value("appsScriptUrl"), payload, "Apps Script", CONFIG.integrations?.appsScriptRequestMode || "no-cors"));
    }

    if (elements.sendN8n?.checked && value("n8nWebhookUrl")) {
      tasks.push(sendIntegration(value("n8nWebhookUrl"), payload, "n8n", CONFIG.integrations?.n8nRequestMode || "cors"));
    }

    if (!tasks.length) {
      showToast("Orçamento salvo no histórico local.");
      return;
    }

    try {
      await Promise.allSettled(tasks);
      showToast("Orçamento salvo e enviado para integrações.");
    } catch (error) {
      showToast("Salvo localmente, mas uma integração falhou.", true);
    }
  }

  async function sendIntegration(url, payload, label, requestMode) {
    const response = await fetch(url, {
      method: "POST",
      mode: requestMode || "cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        event: "amandatur.quote.created",
        label,
        payload
      })
    });

    if (!response.ok && response.type !== "opaque") {
      throw new Error(label + " HTTP " + response.status);
    }
  }

  function openWhatsApp() {
    const validation = validateRequiredFields(false);
    if (!validation.valid) {
      showToast(validation.message, true);
      return;
    }

    const payload = buildQuotePayload();
    const companyNumber = onlyNumbers(value("companyWhatsapp") || CONFIG.brand?.whatsappNumber);
    const url = `https://wa.me/${companyNumber}?text=${encodeURIComponent(buildWhatsAppMessage(payload))}`;
    trackEvent("WhatsAppQuoteClick", {
      value: payload.total_value,
      distance_km: payload.total_km
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyQuote() {
    await navigator.clipboard.writeText(buildWhatsAppMessage(buildQuotePayload()));
    showToast("Resumo copiado com sucesso!");
  }

  function clearForm() {
    const keepApps = value("appsScriptUrl");
    const keepN8n = value("n8nWebhookUrl");
    elements.quoteForm.reset();
    applyConfigDefaults();
    setValue("appsScriptUrl", keepApps);
    setValue("n8nWebhookUrl", keepN8n);
    state.route.distanceKm = 0;
    updateAll();
    saveDraft();
    showToast("Formulário limpo.");
  }

  function validateRequiredFields(strict = true) {
    const fields = CONFIG.fields || {};
    const checks = [
      [fields.requireClientName, "clientName", "Preencha o nome do cliente."],
      [fields.requirePhone, "clientPhone", "Preencha o WhatsApp do cliente."],
      [fields.requireOrigin, "origin", "Preencha a origem."],
      [fields.requireDestination, "destination", "Preencha o destino."],
      [fields.requireDate, "tripDate", "Escolha a data da viagem."],
      [fields.requirePassengers, "passengers", "Informe a quantidade de passageiros."]
    ];

    for (const [required, id, message] of checks) {
      if (required && !value(id)) {
        elements[id]?.focus();
        return { valid: false, message };
      }
    }

    if (strict && fields.requireRouteDistance && numeric("routeKm") <= 0) {
      elements.routeKm?.focus();
      return { valid: false, message: "Calcule ou informe a quilometragem da rota." };
    }

    return { valid: true };
  }

  function readHistory() {
    try {
      return JSON.parse(localStorage.getItem(historyKey) || "[]");
    } catch (error) {
      return [];
    }
  }

  function writeHistory(items) {
    localStorage.setItem(historyKey, JSON.stringify(items));
  }

  function renderHistory() {
    const history = readHistory();

    if (!history.length) {
      elements.historyList.innerHTML = `<div class="history-item"><strong>Nenhum orçamento salvo ainda.</strong><span>Salve o primeiro orçamento para ele aparecer aqui.</span></div>`;
      return;
    }

    elements.historyList.innerHTML = history.map((item) => {
      const modeInfo = TRIP_MODES[item.trip_mode] || TRIP_MODES.round;
      return `
        <div class="history-item">
          <strong><span>${escapeHtml(item.quote_id)}</span><span>${money.format(item.total_value || 0)}</span></strong>
          <span>${escapeHtml(item.client_name || "Cliente")} · ${escapeHtml(item.origin || "Origem")} → ${escapeHtml(item.destination || "Destino")}</span>
          <span>${formatDateBR(item.trip_date)} · ${number.format(Math.round(item.total_km || 0))} km · ${modeInfo.emoji} ${escapeHtml(modeInfo.label)}</span>
        </div>
      `;
    }).join("");
  }

  function clearHistory() {
    localStorage.removeItem(historyKey);
    renderHistory();
    showToast("Histórico limpo.");
  }

  function scheduleDraftSave() {
    clearTimeout(state.timers.draft);
    state.timers.draft = setTimeout(saveDraft, 350);
  }

  function saveDraft() {
    const data = {};
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.type === "checkbox") {
        data[el.id] = el.checked;
      } else {
        data[el.id] = el.value;
      }
    });
    localStorage.setItem(draftKey, JSON.stringify(data));
  }

  function restoreDraft() {
    try {
      const data = JSON.parse(localStorage.getItem(draftKey) || "{}");
      Object.keys(data).forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === "checkbox") {
          el.checked = Boolean(data[id]);
        } else {
          el.value = data[id];
        }
      });
    } catch (error) {
      console.warn("Draft invalido", error);
    }
  }

  function nextQuoteId() {
    const history = readHistory();
    const prefix = CONFIG.calculation?.quotePrefix || "AMANDATUR";
    return `${prefix}-${String(history.length + 1).padStart(3, "0")}`;
  }

  function parseStops() {
    return value("stopsText")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getVehicle() {
    const id = value("vehicleType");
    return (CONFIG.vehicles || []).find((vehicle) => vehicle.id === id) || (CONFIG.vehicles || [])[0];
  }

  function setRouteStatus(message, type) {
    if (!elements.routeStatus) return;
    elements.routeStatus.textContent = message;
    elements.routeStatus.classList.remove("ok", "error");
    if (type) elements.routeStatus.classList.add(type);
  }

  function value(id) {
    return String(elements[id]?.value || "").trim();
  }

  function setValue(id, newValue) {
    if (elements[id]) elements[id].value = newValue;
  }

  function numeric(id) {
    return Number(String(value(id)).replace(",", ".")) || 0;
  }

  function textContent(id, content) {
    if (elements[id]) elements[id].textContent = content;
  }

  function onlyNumbers(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function round(value, decimals) {
    const factor = Math.pow(10, decimals || 0);
    return Math.round(value * factor) / factor;
  }

  function formatDateBR(value) {
    if (!value) return "A definir";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function formatPhoneBR(digits) {
    if (!digits) return "A informar";
    const d = String(digits).replace(/\D/g, "");
    if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return digits;
  }

  function showToast(message, isError) {
    elements.toast.textContent = message;
    elements.toast.style.background = isError ? "#c53345" : "#101015";
    elements.toast.classList.add("active");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => elements.toast.classList.remove("active"), 2800);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
