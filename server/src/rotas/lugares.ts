module.exports = function registrarRotasDeLugares({ app, auth, formatarResultadoLugar, pontuarCorrespondenciaBusca, estadoDosMapas }) {
app.get('/postal-codes/lookup', auth, async (q, r) => {
  const cep = String(q.query.cep || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(cep)) return r.status(400).json({ error: 'Digite um CEP com 8 números.' });
  const key = `viacep:${cep}`;
  const cached = estadoDosMapas.cache.get(key);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('A consulta de CEP está temporariamente indisponível.');
    const data = await response.json();
    if (data.erro) return r.status(404).json({ error: 'Não encontrei esse CEP na base dos Correios.' });
    const resultado = {
      cep: data.cep,
      logradouro: data.logradouro || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
    };
    estadoDosMapas.cache.set(key, { places: resultado, expires: Date.now() + 24 * 60 * 60 * 1000 });
    r.json(resultado);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível consultar esse CEP.' });
  }
});

app.get('/postal-codes/search', auth, async (q, r) => {
  const uf = String(q.query.uf || '').trim().toUpperCase();
  const cidade = String(q.query.city || '').trim();
  const logradouro = String(q.query.street || '').trim();
  if (!/^[A-Z]{2}$/.test(uf) || cidade.length < 3 || logradouro.length < 3 || cidade.length > 100 || logradouro.length > 120) {
    return r.status(400).json({ error: 'Informe UF, cidade e pelo menos 3 letras do logradouro para localizar o CEP.' });
  }
  const key = `viacep:${uf}:${cidade.toLocaleLowerCase('pt-BR')}:${logradouro.toLocaleLowerCase('pt-BR')}`;
  const cached = estadoDosMapas.cache.get(key);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(logradouro)}/json/`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('A consulta de CEP por endereço está temporariamente indisponível.');
    const data = await response.json();
    const resultados = Array.isArray(data) ? data.slice(0, 8).map(item => ({
      cep: item.cep || '',
      logradouro: item.logradouro || logradouro,
      complemento: item.complemento || '',
      bairro: item.bairro || '',
      cidade: item.localidade || cidade,
      uf: item.uf || uf,
    })) : [];
    estadoDosMapas.cache.set(key, { places: resultados, expires: Date.now() + 24 * 60 * 60 * 1000 });
    r.json(resultados);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível pesquisar o CEP deste endereço.' });
  }
});

app.get('/places/search', auth, async (q, r) => {
  const query = String(q.query.q || '').trim();
  if (query.length < 3 || query.length > 120) return r.status(400).json({ error: 'Digite um local com pelo menos 3 caracteres.' });
  const key = `search:${query.toLocaleLowerCase('pt-BR')}`;
  const cached = estadoDosMapas.cache.get(key);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const places = await (estadoDosMapas.fila = estadoDosMapas.fila.catch(() => {}).then(async () => {
      const wait = Math.max(0, 1100 - (Date.now() - estadoDosMapas.ultimoPedido));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      estadoDosMapas.ultimoPedido = Date.now();
      const executarBusca = async termo => {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.search = new URLSearchParams({
          q: termo,
          countrycodes: 'br',
          viewbox: '-48.50,-15.35,-47.25,-16.20',
          format: 'jsonv2',
          limit: '8',
          addressdetails: '1',
          dedupe: '1'
        }).toString();
        const response = await fetch(url, {
          headers: {
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)',
            'Referer': 'https://lembre-web.onrender.com/'
          },
          signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) throw new Error('Busca de locais temporariamente indisponível.');
        return response.json();
      };
      let data = await executarBusca(query);
      const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
      const ordenarCorrespondencias = resultados => resultados
        .map(item => ({ item, score: pontuarCorrespondenciaBusca(item, query) }))
        .sort((a, b) => Number(b.score.exata) - Number(a.score.exata) || b.score.cobertura - a.score.cobertura || b.score.importancia - a.score.importancia);
      let classificados = ordenarCorrespondencias(data);
      let correspondenciasValidas = classificados.filter(resultado => resultado.score.exata || resultado.score.cobertura >= 0.45);
      // Retry with a Brasília context when the first query returns unrelated
      // candidates. The city context is a search hint, never an auto-selection.
      if (!correspondenciasValidas.length && !/bras[ií]lia|distrito federal|\bdf\b/i.test(query)) {
        const wait = Math.max(0, 1100 - (Date.now() - estadoDosMapas.ultimoPedido));
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        estadoDosMapas.ultimoPedido = Date.now();
        data = await executarBusca(`${query}, Brasília, Distrito Federal, Brasil`);
        classificados = ordenarCorrespondencias(data);
        correspondenciasValidas = classificados.filter(resultado => resultado.score.exata || resultado.score.cobertura >= 0.45);
      }
      return correspondenciasValidas.slice(0, 8).map(({ item }) => ({ ...formatarResultadoLugar(item), consulta: normalizar(query) }));
    }));
    estadoDosMapas.cache.set(key, { places, expires: Date.now() + 60 * 60 * 1000 });
    if (estadoDosMapas.cache.size > 300) estadoDosMapas.cache.delete(estadoDosMapas.cache.keys().next().value);
    r.json(places);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível buscar esse local agora.' });
  }
});

app.get('/places/postal-code', auth, async (q, r) => {
  const cep = String(q.query.cep || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(cep)) return r.status(400).json({ error: 'Digite um CEP com 8 números.' });
  const key = `osm-postcode:${cep}`;
  const cached = estadoDosMapas.cache.get(key);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const lugares = await (estadoDosMapas.fila = estadoDosMapas.fila.catch(() => {}).then(async () => {
      const wait = Math.max(0, 1100 - (Date.now() - estadoDosMapas.ultimoPedido));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      estadoDosMapas.ultimoPedido = Date.now();
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({ postalcode: cep, country: 'Brazil', format: 'jsonv2', limit: '5', addressdetails: '1' }).toString();
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)',
          'Referer': 'https://lembre-web.onrender.com/'
        },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error('A busca deste CEP no mapa está temporariamente indisponível.');
      const data = await response.json();
      return data.map(item => formatarResultadoLugar(item, cep));
    }));
    estadoDosMapas.cache.set(key, { places: lugares, expires: Date.now() + 24 * 60 * 60 * 1000 });
    r.json(lugares);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível localizar este CEP no mapa.' });
  }
});

app.get('/places/reverse', auth, async (q, r) => {
  const latitude = Number(q.query.lat);
  const longitude = Number(q.query.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return r.status(400).json({ error: 'As coordenadas selecionadas são inválidas.' });
  }

  const cacheKey = `reverse:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = estadoDosMapas.cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const local = await (estadoDosMapas.fila = estadoDosMapas.fila.catch(() => {}).then(async () => {
      // A very detailed reverse lookup can miss points between mapped
      // buildings. Retry at broader scales, respecting Nominatim's 1 req/s rule.
      for (const zoom of [18, 16, 14]) {
        const wait = Math.max(0, 1100 - (Date.now() - estadoDosMapas.ultimoPedido));
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        estadoDosMapas.ultimoPedido = Date.now();
        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: String(zoom), addressdetails: '1' }).toString();
        const response = await fetch(url, {
          headers: {
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)',
            'Referer': 'https://lembre-web.onrender.com/'
          },
          signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) {
          if (response.status === 404) continue;
          throw new Error('Busca de endereços temporariamente indisponível.');
        }
        const data = await response.json();
        if (!data.display_name) continue;
        return {
          ...formatarResultadoLugar(data),
          id: `coord:${latitude.toFixed(5)},${longitude.toFixed(5)}`,
          latitude,
          longitude,
        };
      }
      throw new Error('Não encontrei um endereço próximo deste ponto. Tente marcar uma rua mais próxima.');
    }));
    estadoDosMapas.cache.set(cacheKey, { places: local, expires: Date.now() + 60 * 60 * 1000 });
    r.json(local);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível identificar este ponto agora.' });
  }
});

app.get('/places/nearby', auth, async (q, r) => {
  const latitude = Number(q.query.lat);
  const longitude = Number(q.query.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return r.status(400).json({ error: 'O ponto do mapa é inválido.' });
  }
  const cacheKey = `nearby:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
  const cached = estadoDosMapas.cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);
  const categoriaDoLocal = tags => {
    const amenity = tags.amenity || '';
    if (/school|university|college|library/.test(amenity)) return 'Educação';
    if (/hospital|clinic|doctors|pharmacy/.test(amenity)) return 'Saúde';
    if (tags.shop) return 'Mercados e lojas';
    if (/restaurant|cafe|fast_food|marketplace/.test(amenity)) return 'Alimentação';
    if (/bus_station|parking/.test(amenity)) return 'Transporte';
    if (/sports_centre|fitness_centre/.test(tags.leisure || '')) return 'Esportes';
    if (tags.leisure === 'park') return 'Lazer e parques';
    if (tags.tourism === 'hotel') return 'Hospedagem';
    if (/museum|attraction/.test(tags.tourism || '') || /cinema|theatre/.test(amenity)) return 'Cultura';
    return '';
  };
  try {
    const distancia = (lat2, lon2) => {
      const rad = valor => valor * Math.PI / 180;
      const dLat = rad(lat2 - latitude), dLon = rad(lon2 - longitude);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(latitude)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
      return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };
    const consultarRaio = async raio => {
      const query = `[out:json][timeout:12];(nwr(around:${raio},${latitude},${longitude})[amenity~"^(school|university|college|hospital|clinic|doctors|pharmacy|restaurant|cafe|fast_food|marketplace|bank|bus_station|parking|library|cinema|theatre)$"];nwr(around:${raio},${latitude},${longitude})[shop~"^(supermarket|convenience|mall|bakery|stationery)$"];nwr(around:${raio},${latitude},${longitude})[tourism~"^(hotel|museum|attraction)$"];nwr(around:${raio},${latitude},${longitude})[leisure~"^(sports_centre|fitness_centre|park)$"];);out center tags 35;`;
      const resposta = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(15000),
      });
      if (!resposta.ok) throw new Error(`Overpass respondeu com HTTP ${resposta.status}.`);
      const dados = await resposta.json();
      return (Array.isArray(dados.elements) ? dados.elements : []).map(item => {
        const tags = item.tags || {};
        const centro = item.center || item;
        return { nome: String(tags.name || '').trim(), categoria: categoriaDoLocal(tags), distancia: Number.isFinite(Number(centro.lat)) && Number.isFinite(Number(centro.lon)) ? distancia(Number(centro.lat), Number(centro.lon)) : null };
      }).filter(item => item.categoria).sort((a, b) => (a.distancia ?? 99999) - (b.distancia ?? 99999));
    };
    let locais = await consultarRaio(700);
    if (!locais.some(item => item.nome)) {
      try {
        const aproximados = await consultarRaio(2000);
        if (aproximados.length) locais = aproximados;
      } catch (error) {
        console.error('Busca aproximada de pontos próximos indisponível:', error.message);
      }
    }
    const lugares = { categories: [...new Set(locais.map(item => item.categoria))].slice(0, 8), places: locais.filter(item => item.nome).slice(0, 8) };
    estadoDosMapas.cache.set(cacheKey, { places: lugares, expires: Date.now() + 15 * 60 * 1000 });
    r.json(lugares);
  } catch (error) {
    console.error('Busca de pontos próximos indisponível:', error.message);
    r.json({ categories: [], places: [] });
  }
});


};
