// sidalog smart search: understands dishes and food words, not just names.
// "pasta" also finds Italian places, "dim sum" finds Cantonese, "cheap" limits to $–$$, etc.
(function () {
  // food word -> related words that show up in a place's name, cuisine or Google category
  const X = {
    'pasta': ['italian', 'trattoria', 'osteria', 'ristorante', 'pasta', 'pastificio'],
    'pizza': ['pizza', 'pizzeria', 'italian'],
    'risotto': ['italian', 'trattoria', 'osteria', 'ristorante'],
    'italian': ['italian', 'trattoria', 'osteria', 'ristorante', 'pizzeria', 'pasta'],
    'sushi': ['sushi', 'omakase', 'japanese'],
    'sashimi': ['sushi', 'omakase', 'japanese', 'seafood', 'izakaya'],
    'omakase': ['omakase', 'sushi', 'kaiseki', 'kappo'],
    'ramen': ['ramen'],
    'udon': ['udon', 'japanese'],
    'soba': ['soba', 'japanese'],
    'tempura': ['tempura', 'japanese'],
    'yakitori': ['yakitori', 'izakaya', 'kushiyaki'],
    'yakiniku': ['yakiniku', 'wagyu', 'japanese barbecue'],
    'izakaya': ['izakaya', 'sake', 'yakitori'],
    'japanese': ['japanese', 'sushi', 'ramen', 'izakaya', 'yakitori', 'omakase', 'yakiniku', 'kaiseki', 'udon', 'soba', 'tempura', 'donburi'],
    'wagyu': ['wagyu', 'yakiniku', 'steak'],
    'steak': ['steak', 'steakhouse', 'grill', 'wagyu', 'chophouse', 'churrasc'],
    'burger': ['burger', 'american', 'diner'],
    'fries': ['burger', 'american'],
    'bbq': ['barbecue', 'bbq', 'grill', 'yakiniku', 'smokehouse'],
    'barbecue': ['barbecue', 'bbq', 'grill', 'yakiniku', 'smokehouse'],
    'korean': ['korean'],
    'kbbq': ['korean barbecue', 'korean'],
    'kimchi': ['korean'],
    'bibimbap': ['korean'],
    'taco': ['mexican', 'taco', 'taqueria'],
    'tacos': ['mexican', 'taco', 'taqueria'],
    'burrito': ['mexican', 'tex-mex'],
    'mexican': ['mexican', 'taco', 'taqueria', 'tex-mex'],
    'tapas': ['spanish', 'tapas'],
    'paella': ['spanish'],
    'spanish': ['spanish', 'tapas'],
    'french': ['french', 'bistro', 'brasserie'],
    'croissant': ['bakery', 'patisserie', 'boulangerie', 'viennoiserie', 'french'],
    'bread': ['bakery', 'boulangerie', 'bread'],
    'pastry': ['bakery', 'patisserie', 'pastry'],
    'cake': ['cake', 'dessert', 'patisserie', 'bakery'],
    'dessert': ['dessert', 'cake', 'patisserie', 'ice cream', 'gelato', 'bakery'],
    'gelato': ['gelato', 'ice cream'],
    'icecream': ['ice cream', 'gelato'],
    'chocolate': ['chocolate', 'dessert', 'patisserie'],
    'bagel': ['bagel', 'deli'],
    'sandwich': ['sandwich', 'deli', 'bakery'],
    'brunch': ['brunch', 'breakfast', 'cafe', 'coffee'],
    'breakfast': ['breakfast', 'brunch', 'cafe', 'kopitiam'],
    'coffee': ['coffee', 'cafe', 'espresso', 'roaster', 'kopi'],
    'tea': ['tea', 'teahouse', 'cafe'],
    'matcha': ['matcha', 'tea', 'japanese', 'cafe'],
    'chinese': ['chinese', 'cantonese', 'sichuan', 'szechuan', 'teochew', 'hokkien', 'dim sum', 'hainanese', 'zi char', 'shanghainese', 'hunan', 'dumpling'],
    'cantonese': ['cantonese', 'dim sum', 'roast'],
    'dimsum': ['dim sum', 'cantonese', 'yum cha'],
    'dumpling': ['dumpling', 'dim sum', 'xiao long bao', 'chinese', 'taiwanese'],
    'dumplings': ['dumpling', 'dim sum', 'xiao long bao', 'chinese', 'taiwanese'],
    'hotpot': ['hot pot', 'hotpot', 'steamboat', 'mala', 'shabu'],
    'mala': ['mala', 'sichuan', 'szechuan', 'hot pot'],
    'sichuan': ['sichuan', 'szechuan', 'mala'],
    'noodle': ['noodle', 'ramen', 'mee', 'mian', 'pho', 'laksa', 'udon', 'soba', 'kway teow'],
    'noodles': ['noodle', 'ramen', 'mee', 'mian', 'pho', 'laksa', 'udon', 'soba', 'kway teow'],
    'rice': ['rice', 'biryani', 'claypot', 'donburi', 'nasi'],
    'claypot': ['claypot'],
    'duck': ['duck', 'roast', 'cantonese'],
    'chickenrice': ['chicken rice', 'hainanese'],
    'chicken': ['chicken', 'fried chicken', 'chicken rice', 'yakitori'],
    'friedchicken': ['fried chicken', 'chicken'],
    'pork': ['pork', 'bak kut teh', 'char siu', 'roast'],
    'bkt': ['bak kut teh'],
    'thai': ['thai', 'mookata'],
    'vietnamese': ['vietnamese', 'pho', 'banh mi'],
    'pho': ['pho', 'vietnamese'],
    'banhmi': ['banh mi', 'vietnamese'],
    'indian': ['indian', 'biryani', 'tandoor', 'south indian', 'north indian'],
    'curry': ['curry', 'indian', 'thai', 'japanese curry', 'malay', 'peranakan'],
    'biryani': ['biryani', 'indian'],
    'prata': ['prata', 'indian', 'mamak'],
    'malay': ['malay', 'nasi', 'indonesian'],
    'nasilemak': ['nasi lemak', 'malay'],
    'satay': ['satay', 'malay', 'indonesian'],
    'indonesian': ['indonesian', 'balinese', 'padang'],
    'laksa': ['laksa', 'peranakan', 'nyonya'],
    'peranakan': ['peranakan', 'nyonya'],
    'local': ['singaporean', 'hawker', 'zi char', 'kopitiam', 'local', 'street food'],
    'hawker': ['hawker', 'food court', 'street food', 'coffee shop'],
    'seafood': ['seafood', 'oyster', 'crab', 'fish', 'lobster'],
    'oyster': ['oyster', 'seafood'],
    'oysters': ['oyster', 'seafood'],
    'crab': ['crab', 'seafood', 'zi char'],
    'fish': ['fish', 'seafood', 'sushi'],
    'lobster': ['lobster', 'seafood'],
    'mediterranean': ['mediterranean', 'greek', 'middle eastern', 'lebanese', 'turkish'],
    'greek': ['greek', 'mediterranean'],
    'turkish': ['turkish', 'mediterranean', 'middle eastern'],
    'kebab': ['kebab', 'turkish', 'middle eastern'],
    'vegetarian': ['vegetarian', 'vegan', 'plant'],
    'vegan': ['vegan', 'vegetarian', 'plant'],
    'halal': ['halal', 'malay', 'indonesian', 'middle eastern', 'turkish', 'pakistani'],
    'cocktail': ['cocktail'],
    'cocktails': ['cocktail'],
    'wine': ['wine', 'champagne', 'vino', 'enoteca'],
    'beer': ['beer', 'pub', 'brew', 'taproom', 'craft'],
    'sake': ['sake', 'izakaya'],
    'whisky': ['whisky', 'whiskey', 'spirits'],
    'whiskey': ['whisky', 'whiskey', 'spirits'],
    'drinks': ['bar', 'cocktail', 'wine', 'pub', 'lounge'],
    'bar': ['bar', 'cocktail', 'wine', 'pub', 'lounge', 'izakaya'],
    'rooftop': ['rooftop', 'sky', 'level'],
    'view': ['rooftop', 'sky', 'level'],
    'romantic': ['fine dining', 'wine', 'rooftop'],
    'date': ['fine dining', 'wine', 'rooftop', 'cocktail'],
    'finedining': ['fine dining'],
    'fancy': ['fine dining'],
  };
  // multi-word phrases folded into a single key before lookup
  const PHRASES = [
    ['dim sum', 'dimsum'], ['hot pot', 'hotpot'], ['ice cream', 'icecream'], ['chicken rice', 'chickenrice'],
    ['fried chicken', 'friedchicken'], ['bak kut teh', 'bkt'], ['nasi lemak', 'nasilemak'], ['banh mi', 'banhmi'],
    ['fine dining', 'finedining'], ['korean bbq', 'kbbq'], ['korean barbecue', 'kbbq'], ['date night', 'date'],
  ];
  // words that set the budget instead of matching text
  const PRICE = { cheap: [1, 2], affordable: [1, 2], budget: [1, 2], inexpensive: [1, 2], expensive: [4, 5], splurge: [4, 5], pricey: [4, 5] };
  const STOP = new Set(['in', 'at', 'the', 'a', 'and', 'with', 'near', 'for', 'place', 'places', 'restaurant', 'restaurants', 'food', 'good', 'best', 'some', 'singapore']);

  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const has = (hay, t) => (t.length < 4 ? new RegExp('(^|[^a-z])' + esc(t)) : null)?.test(hay) ?? hay.includes(t);

  function prepare(raw) {
    let q = ' ' + norm(raw).replace(/[^a-z0-9$ ]+/g, ' ') + ' ';
    for (const [p, k] of PHRASES) q = q.replace(' ' + p + ' ', ' ' + k + ' ');
    const words = [], price = [];
    const terms = q.trim().split(/\s+/).filter(Boolean);
    for (const w of terms) {
      if (PRICE[w]) { price.push(PRICE[w]); continue; }
      if (STOP.has(w) && terms.length > 1) continue;
      const base = w.length > 4 && w.endsWith('s') && !X[w] && X[w.slice(0, -1)] ? w.slice(0, -1) : w;
      words.push({ w: base, exp: X[base] || [] });
    }
    const related = [...new Set(words.flatMap(x => x.exp).filter(e => !words.some(x => x.w === e || x.w.startsWith(e) || e.startsWith(x.w))))];
    return { words, price, related, active: words.length > 0 || price.length > 0 };
  }

  // 0 = not a match; higher = better match
  function score(p, Q, note) {
    if (!Q.active) return 1;
    if (Q.price.length && !Q.price.some(([lo, hi]) => p.b >= lo && p.b <= hi)) return 0;
    const name = norm(p.n);
    const kind = norm(`${p.q} ${p.gc || ''} ${p.s} ${p.c} ${p.k ? [...(p.k.f || []), ...(p.k.d || [])].join(' ') : ''}`);
    const rest = norm(`${p.a || ''} ${p.r || ''} ${p.ad || ''} ${note || ''}`);
    let total = 1;
    for (const { w, exp } of Q.words) {
      let s = 0;
      if (has(name, w)) s = 10;
      else if (has(kind, w)) s = 7;
      else if (exp.some(e => has(kind, e))) s = 5;
      else if (exp.some(e => has(name, e))) s = 4;
      else if (has(rest, w)) s = 3;
      if (!s) return 0;
      total += s;
    }
    return total + (p.gr || 0) / 10;
  }

  window.SmartSearch = { prepare, score };
})();
