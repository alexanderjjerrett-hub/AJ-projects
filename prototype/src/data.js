// SAMPLE DATA: illustrative only, not for navigation.
// Village and lift-station locations are approximate (altitudes checked against
// the AWS Terrain Tiles elevation model). Run lengths, times and
// opening hours are placeholders. Venue names are generic, not real businesses.
// Production data will be built from OpenStreetMap and resort feeds (see docs/DESIGN.md §7).

export const LEVELS = { green: 1, blue: 2, red: 3, black: 4 };
export const LEVEL_NAMES = ['', 'green', 'blue', 'red', 'black'];

export const nodes = [
  { id: 'morzine', name: 'Morzine', aliases: ['morzine village'], lat: 46.179, lon: 6.709, alt: 1000, kind: 'village', country: 'FR' },
  { id: 'pleney_top', name: 'Pleney (top)', aliases: ['pleney', 'le pleney'], lat: 46.166, lon: 6.693, alt: 1500, kind: 'station', country: 'FR' },
  { id: 'nauchets', name: 'Les Nauchets', aliases: ['nauchets'], lat: 46.162, lon: 6.68, alt: 1300, kind: 'station', country: 'FR' },
  { id: 'chavannes', name: 'Chavannes', aliases: ['les chavannes'], lat: 46.1405, lon: 6.6705, alt: 1490, kind: 'station', country: 'FR' },
  { id: 'les_gets', name: 'Les Gets', aliases: ['gets', 'les gets village'], lat: 46.158, lon: 6.67, alt: 1170, kind: 'village', country: 'FR' },
  { id: 'super_morzine', name: 'Super Morzine', aliases: ['super-morzine'], lat: 46.196, lon: 6.735, alt: 1690, kind: 'station', country: 'FR' },
  { id: 'avoriaz', name: 'Avoriaz', aliases: ['avoriaz village', 'avoriaz 1800'], lat: 46.192, lon: 6.775, alt: 1800, kind: 'village', country: 'FR' },
  { id: 'prodains', name: 'Les Prodains', aliases: ['prodains'], lat: 46.1935, lon: 6.7572, alt: 1480, kind: 'station', country: 'FR' },
  { id: 'lindarets', name: 'Les Lindarets', aliases: ['lindarets', 'goat village'], lat: 46.214, lon: 6.77, alt: 1450, kind: 'station', country: 'FR' },
  { id: 'chavanette', name: 'Chavanette (top of Swiss Wall)', aliases: ['chavanette', 'swiss wall top'], lat: 46.177, lon: 6.8079, alt: 2150, kind: 'station', country: 'FR' },
  { id: 'les_crosets', name: 'Les Crosets', aliases: ['crosets'], lat: 46.184, lon: 6.834, alt: 1660, kind: 'village', country: 'CH' },
];

// Edge fields:
//   piste: level (1-4), length (m), flat?            one-way, downhill
//   lift:  liftType, minutes, wait, open, close,
//          pedestrian (foot passengers up), download (can ride it down)
//   bus:   minutes, wait, open, close                both directions
//   walk:  length (m)                                 both directions
export const edges = [
  // Morzine / Pleney / Les Gets
  { id: 'L_pleney', type: 'lift', name: 'Pleney gondola', from: 'morzine', to: 'pleney_top', liftType: 'gondola', minutes: 8, wait: 3, open: '08:45', close: '17:00', pedestrian: true, download: true },
  { id: 'P_pleney_home_blue', type: 'piste', name: 'Pleney home run', from: 'pleney_top', to: 'morzine', level: 2, length: 3000 },
  { id: 'P_pleney_home_red', type: 'piste', name: 'Pleney red', from: 'pleney_top', to: 'morzine', level: 3, length: 2400 },
  { id: 'P_pleney_nauchets', type: 'piste', name: 'Nauchets green', from: 'pleney_top', to: 'nauchets', level: 1, length: 1400, flat: true },
  { id: 'L_nauchets_pleney', type: 'lift', name: 'Nauchets–Pleney chair', from: 'nauchets', to: 'pleney_top', liftType: 'chair', minutes: 7, wait: 2, open: '09:00', close: '16:45' },
  { id: 'L_nauchets_chavannes', type: 'lift', name: 'Nauchets–Chavannes chair', from: 'nauchets', to: 'chavannes', liftType: 'chair', minutes: 6, wait: 2, open: '09:00', close: '16:30' },
  { id: 'P_chavannes_nauchets', type: 'piste', name: 'Chavannes blue', from: 'chavannes', to: 'nauchets', level: 2, length: 1500 },
  { id: 'L_chavannes', type: 'lift', name: 'Chavannes express chair', from: 'les_gets', to: 'chavannes', liftType: 'chair', minutes: 6, wait: 3, open: '09:00', close: '16:45' },
  { id: 'P_chavannes_gets', type: 'piste', name: 'Chavannes green', from: 'chavannes', to: 'les_gets', level: 1, length: 1800 },

  // Morzine / Super Morzine / Avoriaz
  { id: 'L_super_morzine', type: 'lift', name: 'Super Morzine gondola', from: 'morzine', to: 'super_morzine', liftType: 'gondola', minutes: 10, wait: 3, open: '08:45', close: '17:00', pedestrian: true, download: true },
  { id: 'L_zore', type: 'lift', name: 'Zore chair', from: 'super_morzine', to: 'avoriaz', liftType: 'chair', minutes: 8, wait: 2, open: '09:00', close: '16:30' },
  { id: 'P_avoriaz_super', type: 'piste', name: 'Super Morzine blue', from: 'avoriaz', to: 'super_morzine', level: 2, length: 2600 },
  { id: 'L_prodains', type: 'lift', name: 'Prodains Express cable car', from: 'prodains', to: 'avoriaz', liftType: 'cablecar', minutes: 4, wait: 4, open: '08:30', close: '17:30', pedestrian: true, download: true },
  { id: 'P_avoriaz_prodains', type: 'piste', name: 'Prodains red', from: 'avoriaz', to: 'prodains', level: 3, length: 3000 },

  // Avoriaz / Lindarets
  { id: 'P_avoriaz_lindarets', type: 'piste', name: 'Lindarets blue', from: 'avoriaz', to: 'lindarets', level: 2, length: 2800 },
  { id: 'L_lindarets_chair', type: 'lift', name: 'Lindarets chair', from: 'lindarets', to: 'avoriaz', liftType: 'chair', minutes: 9, wait: 3, open: '09:00', close: '16:30' },
  { id: 'L_lindarets_drag', type: 'lift', name: 'Lindarets drag', from: 'lindarets', to: 'avoriaz', liftType: 'drag', minutes: 6, wait: 1, open: '09:00', close: '16:15' },

  // Avoriaz / Swiss Wall / Les Crosets
  { id: 'L_chavanette_approach', type: 'lift', name: 'Chavanette approach chair', from: 'avoriaz', to: 'chavanette', liftType: 'chair', minutes: 8, wait: 2, open: '09:00', close: '16:15' },
  { id: 'P_chavanette_avoriaz', type: 'piste', name: 'Chavanette blue', from: 'chavanette', to: 'avoriaz', level: 2, length: 2500 },
  { id: 'P_swiss_wall', type: 'piste', name: 'The Swiss Wall (Le Mur Suisse)', from: 'chavanette', to: 'les_crosets', level: 4, length: 1000 },
  { id: 'L_chavanette', type: 'lift', name: 'Chavanette chair', from: 'les_crosets', to: 'chavanette', liftType: 'chair', minutes: 10, wait: 3, open: '09:00', close: '16:00', download: true },

  // Valley shuttles (both directions)
  { id: 'B_morzine_gets', type: 'bus', name: 'Morzine–Les Gets shuttle', from: 'morzine', to: 'les_gets', minutes: 15, wait: 15, open: '07:30', close: '19:30' },
  { id: 'B_morzine_prodains', type: 'bus', name: 'Morzine–Prodains shuttle', from: 'morzine', to: 'prodains', minutes: 15, wait: 15, open: '08:00', close: '19:00' },
];

// tags: kids, budget, terrace, apres, live-music, self-service, table-service
// price: 1 (budget) to 3 (premium)
export const pois = [
  // Morzine
  { id: 'mz_bakery', name: 'Village bakery café', category: 'restaurant', node: 'morzine', tags: ['kids', 'budget'], price: 1, open: '07:00', close: '18:30' },
  { id: 'mz_bar', name: 'Après bar on the square', category: 'bar', node: 'morzine', tags: ['apres', 'live-music'], price: 2, open: '15:00', close: '01:00' },
  { id: 'mz_wc', name: 'Public toilets (tourist office)', category: 'toilet', node: 'morzine', tags: [], open: '08:00', close: '19:00' },
  { id: 'mz_hire', name: 'Ski & board hire', category: 'shop', subtype: 'rental', node: 'morzine', tags: ['repair'], price: 2, open: '08:00', close: '19:00' },
  { id: 'mz_pharmacy', name: 'Pharmacy', category: 'shop', subtype: 'pharmacy', node: 'morzine', tags: [], open: '09:00', close: '19:30' },
  { id: 'mz_market', name: 'Supermarket', category: 'shop', subtype: 'supermarket', node: 'morzine', tags: ['budget'], open: '08:00', close: '20:00' },
  { id: 'mz_atm', name: 'Cash machine', category: 'atm', node: 'morzine', tags: [], open: '00:00', close: '23:59' },

  // Pleney / Nauchets / Chavannes / Les Gets
  { id: 'pl_self', name: 'Pleney summit self-service', category: 'restaurant', node: 'pleney_top', tags: ['self-service', 'budget', 'terrace', 'kids'], price: 1, open: '09:00', close: '16:30' },
  { id: 'pl_wc', name: 'Pleney top toilets', category: 'toilet', node: 'pleney_top', tags: [], open: '09:00', close: '17:00' },
  { id: 'na_hut', name: 'Nauchets snack hut', category: 'restaurant', node: 'nauchets', tags: ['budget'], price: 1, open: '10:00', close: '16:00' },
  { id: 'ch_terrace', name: 'Chavannes terrace restaurant', category: 'restaurant', node: 'chavannes', tags: ['terrace', 'table-service'], price: 3, open: '11:30', close: '16:00' },
  { id: 'ch_bar', name: 'Snow-park bar', category: 'bar', node: 'chavannes', tags: ['apres', 'live-music', 'terrace'], price: 2, open: '11:00', close: '17:00' },
  { id: 'ch_wc', name: 'Chavannes toilets', category: 'toilet', node: 'chavannes', tags: [], open: '09:00', close: '16:45' },
  { id: 'lg_crepe', name: 'Village crêperie', category: 'restaurant', node: 'les_gets', tags: ['kids', 'budget'], price: 1, open: '11:30', close: '21:30' },
  { id: 'lg_pub', name: 'Les Gets pub', category: 'bar', node: 'les_gets', tags: ['apres'], price: 2, open: '15:30', close: '01:00' },
  { id: 'lg_hire', name: 'Sports shop & hire', category: 'shop', subtype: 'rental', node: 'les_gets', tags: ['repair'], price: 2, open: '08:30', close: '19:00' },
  { id: 'lg_wc', name: 'Village toilets', category: 'toilet', node: 'les_gets', tags: [], open: '08:00', close: '19:00' },
  { id: 'lg_pharmacy', name: 'Pharmacy', category: 'shop', subtype: 'pharmacy', node: 'les_gets', tags: [], open: '09:00', close: '19:00' },

  // Super Morzine / Avoriaz / Prodains / Lindarets
  { id: 'sm_terrace', name: 'Super Morzine terrace', category: 'restaurant', node: 'super_morzine', tags: ['terrace', 'table-service'], price: 2, open: '11:30', close: '16:00' },
  { id: 'sm_wc', name: 'Super Morzine toilets', category: 'toilet', node: 'super_morzine', tags: [], open: '09:00', close: '17:00' },
  { id: 'av_pizza', name: 'Village pizzeria', category: 'restaurant', node: 'avoriaz', tags: ['kids'], price: 2, open: '11:30', close: '22:00' },
  { id: 'av_bar', name: 'Après-ski bar', category: 'bar', node: 'avoriaz', tags: ['apres', 'live-music', 'terrace'], price: 2, open: '14:00', close: '02:00' },
  { id: 'av_market', name: 'Mini-market', category: 'shop', subtype: 'supermarket', node: 'avoriaz', tags: [], open: '08:00', close: '20:00' },
  { id: 'av_hire', name: 'Hire & repair', category: 'shop', subtype: 'rental', node: 'avoriaz', tags: ['repair'], open: '08:00', close: '19:00' },
  { id: 'av_wc', name: 'Public toilets', category: 'toilet', node: 'avoriaz', tags: [], open: '08:00', close: '20:00' },
  { id: 'av_atm', name: 'Cash machine', category: 'atm', node: 'avoriaz', tags: [], open: '00:00', close: '23:59' },
  { id: 'av_medical', name: 'Medical centre', category: 'firstaid', node: 'avoriaz', tags: [], open: '08:30', close: '19:00' },
  { id: 'pr_snack', name: 'Prodains snack bar', category: 'restaurant', node: 'prodains', tags: ['budget'], price: 1, open: '09:00', close: '17:00' },
  { id: 'pr_wc', name: 'Prodains toilets', category: 'toilet', node: 'prodains', tags: [], open: '08:30', close: '17:30' },
  { id: 'li_goat', name: 'Goat-village chalet restaurant', category: 'restaurant', node: 'lindarets', tags: ['terrace', 'kids', 'table-service'], price: 2, open: '11:30', close: '16:00' },

  // Swiss side
  { id: 'cv_bar', name: 'Chavanette summit bar', category: 'bar', node: 'chavanette', tags: ['terrace'], price: 2, open: '10:00', close: '16:00' },
  { id: 'cr_rest', name: 'Les Crosets restaurant', category: 'restaurant', node: 'les_crosets', tags: ['terrace', 'table-service'], price: 3, open: '11:30', close: '16:30' },
  { id: 'cr_wc', name: 'Les Crosets toilets', category: 'toilet', node: 'les_crosets', tags: [], open: '09:00', close: '17:00' },
];
