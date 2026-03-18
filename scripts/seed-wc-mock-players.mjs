#!/usr/bin/env node
// Seed mock WC 2026 players for development/testing.
// Run: node scripts/seed-wc-mock-players.mjs
// Replace with real data by running fetch-fotmob-players.mjs once squads are announced (~late May 2026).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLines = readFileSync(resolve(__dirname, '..', '.env'), 'utf8').split('\n');
for (const line of envLines) {
  const [key, ...rest] = line.split('=');
  if (key?.trim() && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

// ── Known players for top nations ─────────────────────────────────────────────
// Format: [name, position]
// Teams not listed here get generic placeholder players.

const KNOWN_PLAYERS = {
  'France': [
    ['Mike Maignan', 'GK'], ['Alphonse Areola', 'GK'],
    ['William Saliba', 'CB'], ['Dayot Upamecano', 'CB'], ['Jules Koundé', 'RB'], ['Theo Hernández', 'LB'], ['Lucas Hernández', 'CB'],
    ['N\'Golo Kanté', 'CM'], ['Aurélien Tchouaméni', 'CM'], ['Adrien Rabiot', 'CM'], ['Eduardo Camavinga', 'CM'],
    ['Kylian Mbappé', 'ST'], ['Antoine Griezmann', 'ST'], ['Ousmane Dembélé', 'W'], ['Marcus Thuram', 'ST'], ['Randal Kolo Muani', 'ST'],
  ],
  'England': [
    ['Jordan Pickford', 'GK'], ['Aaron Ramsdale', 'GK'],
    ['Harry Maguire', 'CB'], ['John Stones', 'CB'], ['Trent Alexander-Arnold', 'RB'], ['Luke Shaw', 'LB'], ['Marc Guéhi', 'CB'],
    ['Declan Rice', 'CM'], ['Jude Bellingham', 'CM'], ['Conor Gallagher', 'CM'], ['Phil Foden', 'CM'],
    ['Harry Kane', 'ST'], ['Bukayo Saka', 'W'], ['Marcus Rashford', 'W'], ['Ollie Watkins', 'ST'], ['Cole Palmer', 'W'],
  ],
  'Germany': [
    ['Manuel Neuer', 'GK'], ['Marc-André ter Stegen', 'GK'],
    ['Antonio Rüdiger', 'CB'], ['Nico Schlotterbeck', 'CB'], ['Benjamin Henrichs', 'RB'], ['David Raum', 'LB'], ['Jonathan Tah', 'CB'],
    ['Toni Kroos', 'CM'], ['Joshua Kimmich', 'CM'], ['Florian Wirtz', 'CM'], ['Leroy Sané', 'W'],
    ['Kai Havertz', 'ST'], ['Serge Gnabry', 'W'], ['Thomas Müller', 'ST'], ['Jamal Musiala', 'CM'], ['Niclas Füllkrug', 'ST'],
  ],
  'Spain': [
    ['Unai Simón', 'GK'], ['David Raya', 'GK'],
    ['Pau Cubarsí', 'CB'], ['Aymeric Laporte', 'CB'], ['Dani Carvajal', 'RB'], ['Alejandro Grimaldo', 'LB'], ['Robin Le Normand', 'CB'],
    ['Rodri', 'CM'], ['Pedri', 'CM'], ['Fabián Ruiz', 'CM'], ['Gavi', 'CM'],
    ['Álvaro Morata', 'ST'], ['Lamine Yamal', 'W'], ['Nico Williams', 'W'], ['Dani Olmo', 'CM'], ['Mikel Oyarzabal', 'ST'],
  ],
  'Portugal': [
    ['Rui Patrício', 'GK'], ['Diogo Costa', 'GK'],
    ['Pepe', 'CB'], ['Rúben Dias', 'CB'], ['João Cancelo', 'RB'], ['Nuno Mendes', 'LB'], ['Danilo Pereira', 'CB'],
    ['Bernardo Silva', 'CM'], ['Vitinha', 'CM'], ['João Palhinha', 'CM'], ['Bruno Fernandes', 'CM'],
    ['Cristiano Ronaldo', 'ST'], ['Rafael Leão', 'W'], ['Diogo Jota', 'ST'], ['Pedro Neto', 'W'], ['João Félix', 'ST'],
  ],
  'Brazil': [
    ['Alisson', 'GK'], ['Ederson', 'GK'],
    ['Marquinhos', 'CB'], ['Gabriel Magalhães', 'CB'], ['Danilo', 'RB'], ['Guilherme Arana', 'LB'], ['Éder Militão', 'CB'],
    ['Casemiro', 'CM'], ['Rodrygo', 'W'], ['Lucas Paquetá', 'CM'], ['Bruno Guimarães', 'CM'],
    ['Vinicius Jr', 'W'], ['Richarlison', 'ST'], ['Gabriel Jesus', 'ST'], ['Endrick', 'ST'], ['Raphinha', 'W'],
  ],
  'Argentina': [
    ['Emiliano Martínez', 'GK'], ['Franco Armani', 'GK'],
    ['Cristian Romero', 'CB'], ['Lisandro Martínez', 'CB'], ['Gonzalo Montiel', 'RB'], ['Nicolás Tagliafico', 'LB'], ['Nahuel Molina', 'RB'],
    ['Rodrigo De Paul', 'CM'], ['Alexis Mac Allister', 'CM'], ['Leandro Paredes', 'CM'], ['Enzo Fernández', 'CM'],
    ['Lionel Messi', 'W'], ['Lautaro Martínez', 'ST'], ['Julián Álvarez', 'ST'], ['Ángel Di María', 'W'], ['Paulo Dybala', 'ST'],
  ],
  'Netherlands': [
    ['Bart Verbruggen', 'GK'], ['Jasper Cillessen', 'GK'],
    ['Virgil van Dijk', 'CB'], ['Stefan de Vrij', 'CB'], ['Denzel Dumfries', 'RB'], ['Nathan Aké', 'LB'], ['Matthijs de Ligt', 'CB'],
    ['Frenkie de Jong', 'CM'], ['Teun Koopmeiners', 'CM'], ['Tijjani Reijnders', 'CM'], ['Xavi Simons', 'CM'],
    ['Cody Gakpo', 'W'], ['Memphis Depay', 'ST'], ['Wout Weghorst', 'ST'], ['Donyell Malen', 'W'], ['Steven Bergwijn', 'W'],
  ],
  'Belgium': [
    ['Koen Casteels', 'GK'], ['Simon Mignolet', 'GK'],
    ['Toby Alderweireld', 'CB'], ['Wout Faes', 'CB'], ['Thomas Meunier', 'RB'], ['Yannick Carrasco', 'LB'], ['Arthur Theate', 'CB'],
    ['Kevin De Bruyne', 'CM'], ['Axel Witsel', 'CM'], ['Youri Tielemans', 'CM'], ['Amadou Onana', 'CM'],
    ['Romelu Lukaku', 'ST'], ['Jeremy Doku', 'W'], ['Lois Openda', 'ST'], ['Leandro Trossard', 'W'], ['Johan Bakayoko', 'W'],
  ],
  'Morocco': [
    ['Yassine Bounou', 'GK'], ['Munir Mohamedi', 'GK'],
    ['Romain Saïss', 'CB'], ['Nayef Aguerd', 'CB'], ['Achraf Hakimi', 'RB'], ['Noussair Mazraoui', 'RB'], ['Adam Masina', 'LB'],
    ['Sofyan Amrabat', 'CM'], ['Azzedine Ounahi', 'CM'], ['Selim Amallah', 'CM'], ['Bilal El Khannouss', 'CM'],
    ['Hakim Ziyech', 'W'], ['Youssef En-Nesyri', 'ST'], ['Sofiane Boufal', 'W'], ['Abderrazak Hamdallah', 'ST'], ['Amine Harit', 'W'],
  ],
  'Japan': [
    ['Shuichi Gonda', 'GK'], ['Zion Suzuki', 'GK'],
    ['Maya Yoshida', 'CB'], ['Ko Itakura', 'CB'], ['Hiroki Sakai', 'RB'], ['Yuto Nagatomo', 'LB'], ['Shogo Taniguchi', 'CB'],
    ['Wataru Endo', 'CM'], ['Hidemasa Morita', 'CM'], ['Sho Ito', 'W'], ['Junya Ito', 'W'],
    ['Daichi Kamada', 'CM'], ['Takumi Minamino', 'ST'], ['Ritsu Doan', 'W'], ['Ao Tanaka', 'CM'], ['Kaoru Mitoma', 'W'],
  ],
  'United States': [
    ['Matt Turner', 'GK'], ['Zack Steffen', 'GK'],
    ['Chris Richards', 'CB'], ['Miles Robinson', 'CB'], ['Sergino Dest', 'RB'], ['Antonee Robinson', 'LB'], ['Walker Zimmerman', 'CB'],
    ['Tyler Adams', 'CM'], ['Weston McKennie', 'CM'], ['Yunus Musah', 'CM'], ['Luca de la Torre', 'CM'],
    ['Christian Pulisic', 'W'], ['Folarin Balogun', 'ST'], ['Ricardo Pepi', 'ST'], ['Timothy Weah', 'W'], ['Gio Reyna', 'W'],
  ],
  'Mexico': [
    ['Guillermo Ochoa', 'GK'], ['Rodolfo Cota', 'GK'],
    ['César Montes', 'CB'], ['Johan Vásquez', 'CB'], ['Jorge Sánchez', 'RB'], ['Jesús Gallardo', 'LB'], ['Héctor Moreno', 'CB'],
    ['Edson Álvarez', 'CM'], ['Andrés Guardado', 'CM'], ['Carlos Rodríguez', 'CM'], ['Héctor Herrera', 'CM'],
    ['Hirving Lozano', 'W'], ['Raúl Jiménez', 'ST'], ['Henry Martín', 'ST'], ['Alexis Vega', 'W'], ['Roberto Alvarado', 'W'],
  ],
  'Colombia': [
    ['David Ospina', 'GK'], ['Camilo Vargas', 'GK'],
    ['Yerry Mina', 'CB'], ['Dávinson Sánchez', 'CB'], ['Daniel Muñoz', 'RB'], ['Johan Mojica', 'LB'], ['Carlos Cuesta', 'CB'],
    ['Wilmar Barrios', 'CM'], ['Mateus Uribe', 'CM'], ['Jefferson Lerma', 'CM'], ['Richard Ríos', 'CM'],
    ['James Rodríguez', 'CM'], ['Luis Díaz', 'W'], ['Falcao', 'ST'], ['Rafael Santos Borré', 'ST'], ['Jhon Jader Durán', 'ST'],
  ],
  'Norway': [
    ['Ørjan Nyland', 'GK'], ['Rune Jarstein', 'GK'],
    ['Leo Skiri Østigård', 'CB'], ['Andreas Hanche-Olsen', 'CB'], ['Kristoffer Ajer', 'RB'], ['Fredrik Bjørkan', 'LB'], ['Julian Ryerson', 'RB'],
    ['Sander Berge', 'CM'], ['Martin Ødegaard', 'CM'], ['Patrick Berg', 'CM'], ['Mathias Normann', 'CM'],
    ['Erling Haaland', 'ST'], ['Alexander Sørloth', 'ST'], ['Antonio Nusa', 'W'], ['Mohamed Elyounoussi', 'W'], ['Ola Solbakken', 'W'],
  ],
  'South Korea': [
    ['Kim Seung-gyu', 'GK'], ['Jo Hyeon-woo', 'GK'],
    ['Kim Min-jae', 'CB'], ['Jung Seung-hyun', 'CB'], ['Kim Moon-hwan', 'RB'], ['Hong Chul', 'LB'], ['Kwon Kyung-won', 'CB'],
    ['Jung Woo-young', 'CM'], ['Hwang In-beom', 'CM'], ['Lee Jae-sung', 'CM'], ['Son Jun-ho', 'CM'],
    ['Son Heung-min', 'W'], ['Hwang Hee-chan', 'ST'], ['Cho Gue-sung', 'ST'], ['Lee Kang-in', 'W'], ['Kwon Chang-hoon', 'W'],
  ],
  'Australia': [
    ['Mat Ryan', 'GK'], ['Danny Vukovic', 'GK'],
    ['Harry Souttar', 'CB'], ['Kye Rowles', 'CB'], ['Nathaniel Atkinson', 'RB'], ['Aziz Behich', 'LB'], ['Joel King', 'LB'],
    ['Jackson Irvine', 'CM'], ['Riley McGree', 'CM'], ['Aaron Mooy', 'CM'], ['Keanu Baccus', 'CM'],
    ['Mathew Leckie', 'W'], ['Mitchell Duke', 'ST'], ['Jamie Maclaren', 'ST'], ['Craig Goodwin', 'W'], ['Marco Tilio', 'W'],
  ],
  'Senegal': [
    ['Édouard Mendy', 'GK'], ['Alfred Gomis', 'GK'],
    ['Kalidou Koulibaly', 'CB'], ['Abdou Diallo', 'CB'], ['Bouna Sarr', 'RB'], ['Fode Ballo-Touré', 'LB'], ['Pape Abou Cissé', 'CB'],
    ['Idrissa Gueye', 'CM'], ['Nampalys Mendy', 'CM'], ['Cheikhou Kouyaté', 'CM'], ['Pape Matar Sarr', 'CM'],
    ['Sadio Mané', 'W'], ['Famara Diédhiou', 'ST'], ['Boulaye Dia', 'ST'], ['Ismaïla Sarr', 'W'], ['Nicolas Jackson', 'ST'],
  ],
};

// ── Position distribution for generic squads ──────────────────────────────────

const POSITION_TEMPLATE = [
  'GK', 'GK',
  'CB', 'CB', 'CB', 'RB', 'LB',
  'CM', 'CM', 'CM', 'CM', 'W', 'W',
  'ST', 'ST', 'W',
  // Extra players for larger squads
  'CB', 'CM', 'ST', 'GK',
];

const ALL_TEAMS = [
  'France', 'England', 'Germany', 'Spain', 'Portugal', 'Netherlands',
  'Belgium', 'Croatia', 'Switzerland', 'Austria', 'Norway', 'Scotland',
  'Argentina', 'Brazil', 'Colombia', 'Uruguay', 'Ecuador', 'Paraguay',
  'Morocco', 'Senegal', 'Egypt', 'Ivory Coast', 'Nigeria', 'Tunisia',
  'Algeria', 'South Africa', 'Cape Verde',
  'Japan', 'South Korea', 'Australia', 'Saudi Arabia', 'Qatar',
  'Jordan', 'Uzbekistan', 'Iran',
  'United States', 'Mexico', 'Canada', 'Panama', 'Haiti', 'Curaçao',
  'New Zealand',
];

// ── Build player rows ─────────────────────────────────────────────────────────

const playerRows = [];
let mockIndex = 1;

for (const team of ALL_TEAMS) {
  const known = KNOWN_PLAYERS[team];
  if (known) {
    known.forEach(([name, position], i) => {
      playerRows.push({
        fotmob_id: `mock_${team.replace(/\s+/g, '_').toLowerCase()}_${i + 1}`,
        name,
        team_name: team,
        team_fotmob_id: '',
        position,
        is_available: true,
      });
    });
  } else {
    // Generic squad for teams without known players
    POSITION_TEMPLATE.forEach((position, i) => {
      playerRows.push({
        fotmob_id: `mock_${team.replace(/\s+/g, '_').toLowerCase()}_${i + 1}`,
        name: `${team} ${i + 1}`,
        team_name: team,
        team_fotmob_id: '',
        position,
        is_available: true,
      });
      mockIndex++;
    });
  }
}

// ── Seed ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`Seeding ${playerRows.length} mock WC 2026 players (${ALL_TEAMS.length} nations)...\n`);

  await supabase
    .from('players')
    .update({ is_available: false })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  for (let i = 0; i < playerRows.length; i += 200) {
    const { error } = await supabase
      .from('players')
      .upsert(playerRows.slice(i, i + 200), { onConflict: 'fotmob_id' });
    if (error) { console.error('Upsert failed:', error.message); process.exit(1); }
  }

  const byTeam = {};
  for (const p of playerRows) byTeam[p.team_name] = (byTeam[p.team_name] ?? 0) + 1;
  for (const [team, count] of Object.entries(byTeam)) {
    console.log(`  ${team.padEnd(22)} ${count} players`);
  }

  console.log(`\n✓ ${playerRows.length} mock players seeded.`);
  console.log('Re-run fetch-fotmob-players.mjs in late May 2026 to replace with real squad data.\n');
})();
