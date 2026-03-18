import type { Position } from '@/types/models';

interface MockPlayerData {
  name: string;
  teamName: string;
  position: Position;
}

export const MOCK_PLAYERS: MockPlayerData[] = [
  // ── Real Madrid ──────────────────────────────────────────
  { name: 'Thibaut Courtois',     teamName: 'Real Madrid',      position: 'GK' },
  { name: 'Éder Militão',         teamName: 'Real Madrid',      position: 'CB' },
  { name: 'Antonio Rüdiger',      teamName: 'Real Madrid',      position: 'CB' },
  { name: 'Dani Carvajal',        teamName: 'Real Madrid',      position: 'RB' },
  { name: 'Ferland Mendy',        teamName: 'Real Madrid',      position: 'LB' },
  { name: 'Luka Modrić',          teamName: 'Real Madrid',      position: 'CM' },
  { name: 'Aurelien Tchouaméni',  teamName: 'Real Madrid',      position: 'CM' },
  { name: 'Eduardo Camavinga',    teamName: 'Real Madrid',      position: 'CM' },
  { name: 'Jude Bellingham',      teamName: 'Real Madrid',      position: 'CM' },
  { name: 'Vinicius Jr',          teamName: 'Real Madrid',      position: 'W'  },
  { name: 'Rodrygo',              teamName: 'Real Madrid',      position: 'W'  },
  { name: 'Kylian Mbappé',        teamName: 'Real Madrid',      position: 'ST' },

  // ── Barcelona ─────────────────────────────────────────────
  { name: 'Iñaki Peña',           teamName: 'Barcelona',        position: 'GK' },
  { name: 'Ronald Araujo',        teamName: 'Barcelona',        position: 'CB' },
  { name: 'Pau Cubarsí',          teamName: 'Barcelona',        position: 'CB' },
  { name: 'Jules Koundé',         teamName: 'Barcelona',        position: 'RB' },
  { name: 'Alejandro Balde',      teamName: 'Barcelona',        position: 'LB' },
  { name: 'Pedri',                teamName: 'Barcelona',        position: 'CM' },
  { name: 'Gavi',                 teamName: 'Barcelona',        position: 'CM' },
  { name: 'Marc Casadó',          teamName: 'Barcelona',        position: 'CM' },
  { name: 'Frenkie de Jong',      teamName: 'Barcelona',        position: 'CM' },
  { name: 'Lamine Yamal',         teamName: 'Barcelona',        position: 'W'  },
  { name: 'Raphinha',             teamName: 'Barcelona',        position: 'W'  },
  { name: 'Robert Lewandowski',   teamName: 'Barcelona',        position: 'ST' },

  // ── Bayern Munich ─────────────────────────────────────────
  { name: 'Manuel Neuer',         teamName: 'Bayern Munich',    position: 'GK' },
  { name: 'Kim Min-jae',          teamName: 'Bayern Munich',    position: 'CB' },
  { name: 'Dayot Upamecano',      teamName: 'Bayern Munich',    position: 'CB' },
  { name: 'Noussair Mazraoui',    teamName: 'Bayern Munich',    position: 'RB' },
  { name: 'Alphonso Davies',      teamName: 'Bayern Munich',    position: 'LB' },
  { name: 'Joshua Kimmich',       teamName: 'Bayern Munich',    position: 'CM' },
  { name: 'Leon Goretzka',        teamName: 'Bayern Munich',    position: 'CM' },
  { name: 'Aleksandar Pavlović',  teamName: 'Bayern Munich',    position: 'CM' },
  { name: 'Leroy Sané',           teamName: 'Bayern Munich',    position: 'W'  },
  { name: 'Michael Olise',        teamName: 'Bayern Munich',    position: 'W'  },
  { name: 'Kingsley Coman',       teamName: 'Bayern Munich',    position: 'W'  },
  { name: 'Harry Kane',           teamName: 'Bayern Munich',    position: 'ST' },

  // ── Manchester City ───────────────────────────────────────
  { name: 'Ederson',              teamName: 'Manchester City',  position: 'GK' },
  { name: 'Rúben Dias',           teamName: 'Manchester City',  position: 'CB' },
  { name: 'Manuel Akanji',        teamName: 'Manchester City',  position: 'CB' },
  { name: 'Kyle Walker',          teamName: 'Manchester City',  position: 'RB' },
  { name: 'Joško Gvardiol',       teamName: 'Manchester City',  position: 'LB' },
  { name: 'Kevin De Bruyne',      teamName: 'Manchester City',  position: 'CM' },
  { name: 'Rodri',                teamName: 'Manchester City',  position: 'CM' },
  { name: 'Bernardo Silva',       teamName: 'Manchester City',  position: 'CM' },
  { name: 'İlkay Gündoğan',       teamName: 'Manchester City',  position: 'CM' },
  { name: 'Jeremy Doku',          teamName: 'Manchester City',  position: 'W'  },
  { name: 'Jack Grealish',        teamName: 'Manchester City',  position: 'W'  },
  { name: 'Erling Haaland',       teamName: 'Manchester City',  position: 'ST' },

  // ── Liverpool ─────────────────────────────────────────────
  { name: 'Alisson',              teamName: 'Liverpool',        position: 'GK' },
  { name: 'Virgil van Dijk',      teamName: 'Liverpool',        position: 'CB' },
  { name: 'Ibrahima Konaté',      teamName: 'Liverpool',        position: 'CB' },
  { name: 'Trent Alexander-Arnold', teamName: 'Liverpool',      position: 'RB' },
  { name: 'Andy Robertson',       teamName: 'Liverpool',        position: 'LB' },
  { name: 'Alexis Mac Allister',  teamName: 'Liverpool',        position: 'CM' },
  { name: 'Dominik Szoboszlai',   teamName: 'Liverpool',        position: 'CM' },
  { name: 'Ryan Gravenberch',     teamName: 'Liverpool',        position: 'CM' },
  { name: 'Mohamed Salah',        teamName: 'Liverpool',        position: 'W'  },
  { name: 'Luis Díaz',            teamName: 'Liverpool',        position: 'W'  },
  { name: 'Cody Gakpo',           teamName: 'Liverpool',        position: 'W'  },
  { name: 'Darwin Núñez',         teamName: 'Liverpool',        position: 'ST' },

  // ── PSG ───────────────────────────────────────────────────
  { name: 'Gianluigi Donnarumma', teamName: 'PSG',              position: 'GK' },
  { name: 'Marquinhos',           teamName: 'PSG',              position: 'CB' },
  { name: 'William Pacho',        teamName: 'PSG',              position: 'CB' },
  { name: 'Achraf Hakimi',        teamName: 'PSG',              position: 'RB' },
  { name: 'Lucas Hernández',      teamName: 'PSG',              position: 'LB' },
  { name: 'Vitinha',              teamName: 'PSG',              position: 'CM' },
  { name: 'João Neves',           teamName: 'PSG',              position: 'CM' },
  { name: 'Fabián Ruiz',          teamName: 'PSG',              position: 'CM' },
  { name: 'Warren Zaïre-Emery',   teamName: 'PSG',              position: 'CM' },
  { name: 'Ousmane Dembélé',      teamName: 'PSG',              position: 'W'  },
  { name: 'Bradley Barcola',      teamName: 'PSG',              position: 'W'  },
  { name: 'Gonçalo Ramos',        teamName: 'PSG',              position: 'ST' },

  // ── Arsenal ───────────────────────────────────────────────
  { name: 'David Raya',           teamName: 'Arsenal',          position: 'GK' },
  { name: 'William Saliba',       teamName: 'Arsenal',          position: 'CB' },
  { name: 'Gabriel Magalhães',    teamName: 'Arsenal',          position: 'CB' },
  { name: 'Ben White',            teamName: 'Arsenal',          position: 'RB' },
  { name: 'Jurrien Timber',       teamName: 'Arsenal',          position: 'LB' },
  { name: 'Thomas Partey',        teamName: 'Arsenal',          position: 'CM' },
  { name: 'Martin Ødegaard',      teamName: 'Arsenal',          position: 'CM' },
  { name: 'Declan Rice',          teamName: 'Arsenal',          position: 'CM' },
  { name: 'Bukayo Saka',          teamName: 'Arsenal',          position: 'W'  },
  { name: 'Gabriel Martinelli',   teamName: 'Arsenal',          position: 'W'  },
  { name: 'Kai Havertz',          teamName: 'Arsenal',          position: 'ST' },

  // ── Inter Milan ───────────────────────────────────────────
  { name: 'Yann Sommer',          teamName: 'Inter Milan',      position: 'GK' },
  { name: 'Francesco Acerbi',     teamName: 'Inter Milan',      position: 'CB' },
  { name: 'Alessandro Bastoni',   teamName: 'Inter Milan',      position: 'CB' },
  { name: 'Denzel Dumfries',      teamName: 'Inter Milan',      position: 'RB' },
  { name: 'Federico Dimarco',     teamName: 'Inter Milan',      position: 'LB' },
  { name: 'Nicolò Barella',       teamName: 'Inter Milan',      position: 'CM' },
  { name: 'Hakan Çalhanoğlu',     teamName: 'Inter Milan',      position: 'CM' },
  { name: 'Henrikh Mkhitaryan',   teamName: 'Inter Milan',      position: 'CM' },
  { name: 'Davide Frattesi',      teamName: 'Inter Milan',      position: 'CM' },
  { name: 'Marcus Thuram',        teamName: 'Inter Milan',      position: 'W'  },
  { name: 'Lautaro Martínez',     teamName: 'Inter Milan',      position: 'ST' },

  // ── Atletico Madrid ───────────────────────────────────────
  { name: 'Jan Oblak',            teamName: 'Atletico Madrid',  position: 'GK' },
  { name: 'José Giménez',         teamName: 'Atletico Madrid',  position: 'CB' },
  { name: 'Robin Le Normand',     teamName: 'Atletico Madrid',  position: 'CB' },
  { name: 'Nahuel Molina',        teamName: 'Atletico Madrid',  position: 'RB' },
  { name: 'Reinildo',             teamName: 'Atletico Madrid',  position: 'LB' },
  { name: 'Rodrigo De Paul',      teamName: 'Atletico Madrid',  position: 'CM' },
  { name: 'Koke',                 teamName: 'Atletico Madrid',  position: 'CM' },
  { name: 'Conor Gallagher',      teamName: 'Atletico Madrid',  position: 'CM' },
  { name: 'Samuel Lino',          teamName: 'Atletico Madrid',  position: 'W'  },
  { name: 'Antoine Griezmann',    teamName: 'Atletico Madrid',  position: 'W'  },
  { name: 'Julián Álvarez',       teamName: 'Atletico Madrid',  position: 'ST' },

  // ── Borussia Dortmund ─────────────────────────────────────
  { name: 'Gregor Kobel',         teamName: 'Borussia Dortmund', position: 'GK' },
  { name: 'Nico Schlotterbeck',   teamName: 'Borussia Dortmund', position: 'CB' },
  { name: 'Niklas Süle',          teamName: 'Borussia Dortmund', position: 'CB' },
  { name: 'Julian Ryerson',       teamName: 'Borussia Dortmund', position: 'RB' },
  { name: 'Ramy Bensebaini',      teamName: 'Borussia Dortmund', position: 'LB' },
  { name: 'Emre Can',             teamName: 'Borussia Dortmund', position: 'CM' },
  { name: 'Marcel Sabitzer',      teamName: 'Borussia Dortmund', position: 'CM' },
  { name: 'Karim Adeyemi',        teamName: 'Borussia Dortmund', position: 'W'  },
  { name: 'Jamie Gittens',        teamName: 'Borussia Dortmund', position: 'W'  },
  { name: 'Serhou Guirassy',      teamName: 'Borussia Dortmund', position: 'ST' },

  // ── AC Milan ──────────────────────────────────────────────
  { name: 'Mike Maignan',         teamName: 'AC Milan',         position: 'GK' },
  { name: 'Fikayo Tomori',        teamName: 'AC Milan',         position: 'CB' },
  { name: 'Malick Thiaw',         teamName: 'AC Milan',         position: 'CB' },
  { name: 'Emerson Royal',        teamName: 'AC Milan',         position: 'RB' },
  { name: 'Theo Hernández',       teamName: 'AC Milan',         position: 'LB' },
  { name: 'Tijjani Reijnders',    teamName: 'AC Milan',         position: 'CM' },
  { name: 'Youssouf Fofana',      teamName: 'AC Milan',         position: 'CM' },
  { name: 'Christian Pulisic',    teamName: 'AC Milan',         position: 'W'  },
  { name: 'Rafael Leão',          teamName: 'AC Milan',         position: 'W'  },
  { name: 'Álvaro Morata',        teamName: 'AC Milan',         position: 'ST' },

  // ── Bayer Leverkusen ──────────────────────────────────────
  { name: 'Lukáš Hrádecký',       teamName: 'Bayer Leverkusen', position: 'GK' },
  { name: 'Jonathan Tah',         teamName: 'Bayer Leverkusen', position: 'CB' },
  { name: 'Piero Hincapié',       teamName: 'Bayer Leverkusen', position: 'CB' },
  { name: 'Jeremie Frimpong',     teamName: 'Bayer Leverkusen', position: 'RB' },
  { name: 'Alejandro Grimaldo',   teamName: 'Bayer Leverkusen', position: 'LB' },
  { name: 'Granit Xhaka',         teamName: 'Bayer Leverkusen', position: 'CM' },
  { name: 'Exequiel Palacios',    teamName: 'Bayer Leverkusen', position: 'CM' },
  { name: 'Florian Wirtz',        teamName: 'Bayer Leverkusen', position: 'W'  },
  { name: 'Jonas Hofmann',        teamName: 'Bayer Leverkusen', position: 'W'  },
  { name: 'Victor Boniface',      teamName: 'Bayer Leverkusen', position: 'ST' },
];
