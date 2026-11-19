// header-mapping-system.ts

export type ElementType =
	| 'Actor'
	| 'Faction'
	| 'Location'
	| 'Item'
	| 'Plot'
	| 'Relationship'
	| 'Event'
	| 'Secret'
	| 'Rule'
	| 'Note'
	| 'Handout'
	| 'Timeline'
	| 'Deck'
	| 'Scene'
	| 'Session'
	| 'Clue'
	| 'Table'
	| 'Media';

export interface HeaderMapping {
	[headerText: string]: ElementType;
}

export interface GameSystemConfig {
	id: string;
	name: string;
	headerMappings: HeaderMapping;
	aliases?: HeaderMapping; // Alternative headers that map to same types
}

export interface LanguageConfig {
	locale: string;
	name: string;
	headerMappings: HeaderMapping;
}

export interface CampaignConfig {
	id: string;
	name: string;
	gameSystem?: string;
	language?: string;
	customMappings?: HeaderMapping; // Override specific mappings
	disabledMappings?: string[]; // Disable certain header types
}

// Base English mappings
const BASE_ENGLISH_MAPPINGS: HeaderMapping = {
	// Characters/NPCs
	Actors: 'Actor',
	NPCs: 'Actor',
	Characters: 'Actor',
	'Party Members': 'Actor',
	'Player Characters': 'Actor',
	'Non-Player Characters': 'Actor',
	People: 'Actor',
	Personas: 'Actor',
	Cast: 'Actor',
	'Dramatis Personae': 'Actor',

	// Places
	Locations: 'Location',
	Places: 'Location',
	Areas: 'Location',
	Regions: 'Location',
	Districts: 'Location',
	Maps: 'Location',
	Geography: 'Location',
	Settings: 'Location',
	Venues: 'Location',
	Sites: 'Location',

	// Organizations
	Factions: 'Faction',
	Organizations: 'Faction',
	Groups: 'Faction',
	Guilds: 'Faction',
	Cults: 'Faction',
	Corporations: 'Faction',
	Houses: 'Faction',
	Clans: 'Faction',
	Parties: 'Faction',
	Alliances: 'Faction',

	// Items
	Items: 'Item',
	Equipment: 'Item',
	Gear: 'Item',
	Treasure: 'Item',
	Artifacts: 'Item',
	Objects: 'Item',
	Props: 'Item',
	Loot: 'Item',

	// Plots & Stories
	Plots: 'Plot',
	Stories: 'Plot',
	Quests: 'Plot',
	Adventures: 'Plot',
	Mysteries: 'Plot',
	Campaigns: 'Plot',
	Storylines: 'Plot',
	Narratives: 'Plot',
	Threads: 'Plot',
	Arcs: 'Plot',

	// Events & Timeline
	Events: 'Event',
	Happenings: 'Event',
	Occurrences: 'Event',
	Incidents: 'Event',
	Timeline: 'Timeline',
	Chronology: 'Timeline',
	History: 'Timeline',
	Schedule: 'Timeline',
	Calendar: 'Timeline',

	// Scenes & Sessions
	Scenes: 'Scene',
	Encounters: 'Scene',
	Situations: 'Scene',
	Moments: 'Scene',
	Sessions: 'Session',
	Games: 'Session',
	Meetings: 'Session',

	// Information Management
	Secrets: 'Secret',
	'Hidden Information': 'Secret',
	'GM Notes': 'Secret',
	'Behind the Scenes': 'Secret',
	Spoilers: 'Secret',
	Confidential: 'Secret',
	Private: 'Secret',

	Clues: 'Clue',
	Evidence: 'Clue',
	Leads: 'Clue',
	Hints: 'Clue',
	Signs: 'Clue',
	Traces: 'Clue',

	Handouts: 'Handout',
	'Player Handouts': 'Handout',
	Documents: 'Handout',
	Letters: 'Handout',
	Notices: 'Handout',
	Flyers: 'Handout',

	// Relationships
	Relationships: 'Relationship',
	Connections: 'Relationship',
	Politics: 'Relationship',
	Diplomacy: 'Relationship',
	Bonds: 'Relationship',
	Links: 'Relationship',

	// Rules & Mechanics
	Rules: 'Rule',
	Mechanics: 'Rule',
	Systems: 'Rule',
	Procedures: 'Rule',
	Guidelines: 'Rule',

	Tables: 'Table',
	'Random Tables': 'Table',
	Charts: 'Table',
	Generators: 'Table',
	Lists: 'Table',
	References: 'Table',

	// Media & Presentation
	Media: 'Media',
	Images: 'Media',
	Pictures: 'Media',
	Audio: 'Media',
	Music: 'Media',
	Sounds: 'Media',
	Videos: 'Media',
	Files: 'Media',

	Decks: 'Deck',
	Slides: 'Deck',
	Presentations: 'Deck',
	Slideshows: 'Deck',

	// General
	Notes: 'Note',
	Information: 'Note',
	Details: 'Note',
	Miscellaneous: 'Note',
	Misc: 'Note',
	Other: 'Note'
};

// Game system specific configurations
const GAME_SYSTEM_CONFIGS: GameSystemConfig[] = [
	{
		id: 'dnd5e',
		name: 'D&D 5th Edition',
		headerMappings: {
			...BASE_ENGLISH_MAPPINGS,
			Monsters: 'Actor',
			Creatures: 'Actor',
			Beasts: 'Actor',
			Villains: 'Actor',
			Dungeons: 'Location',
			Rooms: 'Location',
			Lairs: 'Location',
			'Magic Items': 'Item',
			'Magical Artifacts': 'Item',
			Spells: 'Rule',
			'Spell Lists': 'Table',
			Classes: 'Rule',
			Races: 'Rule',
			Campaign: 'Plot',
			'Adventure Paths': 'Plot',
			'Story Arcs': 'Plot',
			Scenarios: 'Plot',
			'Combat Encounters': 'Scene',
			'Random Encounters': 'Table',
			'Treasure Tables': 'Table',
			'Name Generators': 'Table',
			'Campaign Timeline': 'Timeline',
			'Adventure Hooks': 'Clue',
			'Plot Hooks': 'Clue',
			Handouts: 'Handout',
			'Player Maps': 'Media',
			'Battle Maps': 'Media'
		}
	},

	{
		id: 'call_of_cthulhu',
		name: 'Call of Cthulhu',
		headerMappings: {
			...BASE_ENGLISH_MAPPINGS,
			Investigators: 'Actor',
			Cultists: 'Actor',
			Entities: 'Actor',
			'Great Old Ones': 'Actor',
			Mythos: 'Secret',
			'Forbidden Knowledge': 'Secret',
			Tomes: 'Item',
			Artifacts: 'Item',
			Sanity: 'Rule',
			'Sanity Loss': 'Rule',
			Scenarios: 'Plot',
			Campaigns: 'Plot',
			Investigations: 'Plot',
			'Story Lines': 'Plot',
			Handouts: 'Handout',
			'Newspaper Clippings': 'Handout',
			'Investigation Timeline': 'Timeline',
			Clues: 'Clue',
			Evidence: 'Clue',
			Research: 'Clue',
			'Mythos Tomes': 'Item',
			Spells: 'Rule',
			Rituals: 'Rule'
		}
	},

	{
		id: 'vampire_masquerade',
		name: 'Vampire: The Masquerade',
		headerMappings: {
			...BASE_ENGLISH_MAPPINGS,
			Kindred: 'Actor',
			Mortals: 'Actor',
			Ghouls: 'Actor',
			Coteries: 'Faction',
			Clans: 'Faction',
			Sects: 'Faction',
			Domains: 'Location',
			Havens: 'Location',
			Elysium: 'Location',
			'Blood Bonds': 'Relationship',
			Boons: 'Relationship',
			Prestation: 'Relationship',
			Chronicles: 'Plot',
			Stories: 'Plot',
			Plots: 'Plot',
			'Coterie Stories': 'Plot',
			'Chronicle Timeline': 'Timeline',
			'Domain Politics': 'Secret',
			'Clan Secrets': 'Secret',
			Feeding: 'Rule',
			Disciplines: 'Rule',
			Generation: 'Rule'
		}
	},

	{
		id: 'cyberpunk',
		name: 'Cyberpunk',
		headerMappings: {
			...BASE_ENGLISH_MAPPINGS,
			Netrunners: 'Actor',
			Rockerboys: 'Actor',
			Solos: 'Actor',
			Corps: 'Faction',
			Corporations: 'Faction',
			Gangs: 'Faction',
			Street: 'Location',
			Net: 'Location',
			Cyberspace: 'Location',
			'Corporate Zones': 'Location',
			Chrome: 'Item',
			Cyberware: 'Item',
			Programs: 'Item',
			ICE: 'Item',
			Data: 'Secret',
			'Corporate Secrets': 'Secret',
			'Black Ops': 'Secret',
			Runs: 'Plot',
			Jobs: 'Plot',
			Campaigns: 'Plot',
			Operations: 'Plot',
			'Netrunning Rules': 'Rule',
			Hacking: 'Rule',
			'Random Encounters': 'Table',
			'Corporate Names': 'Table'
		}
	},

	{
		id: 'fate',
		name: 'FATE Core',
		headerMappings: {
			...BASE_ENGLISH_MAPPINGS,
			Aspects: 'Rule',
			'Situation Aspects': 'Rule',
			'Character Aspects': 'Rule',
			Stunts: 'Rule',
			Skills: 'Rule',
			Stress: 'Rule',
			Consequences: 'Rule',
			'Fate Points': 'Rule',
			Compels: 'Rule',
			Invocations: 'Rule',
			'Create Advantage': 'Rule',
			Zones: 'Location',
			Adventures: 'Plot',
			Scenarios: 'Plot',
			'Story Arcs': 'Plot',
			Issues: 'Secret',
			'Campaign Issues': 'Secret'
		}
	}
];

// Language configurations
const LANGUAGE_CONFIGS: LanguageConfig[] = [
	{
		locale: 'en',
		name: 'English',
		headerMappings: BASE_ENGLISH_MAPPINGS
	},

	{
		locale: 'es',
		name: 'Español',
		headerMappings: {
			Actores: 'Actor',
			PNJs: 'Actor',
			Personajes: 'Actor',
			'Personajes Jugadores': 'Actor',
			'Personajes No Jugadores': 'Actor',
			Personas: 'Actor',
			Reparto: 'Actor',

			Ubicaciones: 'Location',
			Lugares: 'Location',
			Áreas: 'Location',
			Regiones: 'Location',
			Mapas: 'Location',
			Sitios: 'Location',

			Facciones: 'Faction',
			Organizaciones: 'Faction',
			Grupos: 'Faction',
			Gremios: 'Faction',
			Corporaciones: 'Faction',
			Casas: 'Faction',

			Objetos: 'Item',
			Equipo: 'Item',
			Tesoro: 'Item',
			Artefactos: 'Item',
			'Objetos Mágicos': 'Item',

			Tramas: 'Plot',
			Historias: 'Plot',
			Aventuras: 'Plot',
			Misterios: 'Plot',
			Campañas: 'Plot',
			Narrativas: 'Plot',
			Hilos: 'Plot',
			Arcos: 'Plot',

			Eventos: 'Event',
			Acontecimientos: 'Event',
			Sucesos: 'Event',
			Cronología: 'Timeline',
			'Línea de Tiempo': 'Timeline',
			Historia: 'Timeline',

			Escenas: 'Scene',
			Encuentros: 'Scene',
			Situaciones: 'Scene',
			Sesiones: 'Session',
			Partidas: 'Session',

			Secretos: 'Secret',
			'Información Oculta': 'Secret',
			'Notas del DJ': 'Secret',
			Confidencial: 'Secret',

			Pistas: 'Clue',
			Evidencia: 'Clue',
			Indicios: 'Clue',
			Señales: 'Clue',

			Handouts: 'Handout',
			Documentos: 'Handout',
			Volantes: 'Handout',
			Folletos: 'Handout',

			Relaciones: 'Relationship',
			Conexiones: 'Relationship',
			Política: 'Relationship',
			Alianzas: 'Relationship',
			Vínculos: 'Relationship',

			Reglas: 'Rule',
			Mecánicas: 'Rule',
			Sistemas: 'Rule',

			Tablas: 'Table',
			'Tablas Aleatorias': 'Table',
			Gráficos: 'Table',
			Generadores: 'Table',
			Listas: 'Table',

			Medios: 'Media',
			Imágenes: 'Media',
			Audio: 'Media',
			Música: 'Media',
			Videos: 'Media',

			Mazos: 'Deck',
			Presentaciones: 'Deck',
			Diapositivas: 'Deck',

			Notas: 'Note',
			Información: 'Note',
			Detalles: 'Note',
			Varios: 'Note'
		}
	},

	{
		locale: 'fr',
		name: 'Français',
		headerMappings: {
			Acteurs: 'Actor',
			PNJs: 'Actor',
			Personnages: 'Actor',
			'Personnages Joueurs': 'Actor',
			'Personnages Non-Joueurs': 'Actor',
			Personnes: 'Actor',
			Distribution: 'Actor',

			Lieux: 'Location',
			Endroits: 'Location',
			Zones: 'Location',
			Régions: 'Location',
			Cartes: 'Location',
			Sites: 'Location',

			Factions: 'Faction',
			Organisations: 'Faction',
			Groupes: 'Faction',
			Guildes: 'Faction',
			Corporations: 'Faction',
			Maisons: 'Faction',

			Objets: 'Item',
			Équipement: 'Item',
			Trésor: 'Item',
			Artefacts: 'Item',
			'Objets Magiques': 'Item',

			Intrigues: 'Plot',
			Histoires: 'Plot',
			Aventures: 'Plot',
			Mystères: 'Plot',
			Campagnes: 'Plot',
			Récits: 'Plot',
			Fils: 'Plot',
			Arcs: 'Plot',

			Événements: 'Event',
			Occurrences: 'Event',
			Incidents: 'Event',
			Chronologie: 'Timeline',
			'Ligne de Temps': 'Timeline',
			Histoire: 'Timeline',

			Scènes: 'Scene',
			Rencontres: 'Scene',
			Situations: 'Scene',
			Sessions: 'Session',
			Parties: 'Session',

			Secrets: 'Secret',
			'Information Cachée': 'Secret',
			'Notes du MJ': 'Secret',
			Confidentiel: 'Secret',

			Indices: 'Clue',
			Preuves: 'Clue',
			Pistes: 'Clue',
			Signes: 'Clue',

			Documents: 'Handout',
			Tracts: 'Handout',
			Prospectus: 'Handout',

			Relations: 'Relationship',
			Connexions: 'Relationship',
			Politique: 'Relationship',
			Alliances: 'Relationship',
			Liens: 'Relationship',

			Règles: 'Rule',
			Mécaniques: 'Rule',
			Systèmes: 'Rule',

			Tables: 'Table',
			'Tables Aléatoires': 'Table',
			Graphiques: 'Table',
			Générateurs: 'Table',
			Listes: 'Table',

			Médias: 'Media',
			Images: 'Media',
			Audio: 'Media',
			Musique: 'Media',
			Vidéos: 'Media',

			Paquets: 'Deck',
			Présentations: 'Deck',
			Diapositives: 'Deck',

			Notes: 'Note',
			Information: 'Note',
			Détails: 'Note',
			Divers: 'Note'
		}
	},

	{
		locale: 'de',
		name: 'Deutsch',
		headerMappings: {
			Akteure: 'Actor',
			NSCs: 'Actor',
			Charaktere: 'Actor',
			Spielercharaktere: 'Actor',
			Nichtspielercharaktere: 'Actor',
			Personen: 'Actor',
			Besetzung: 'Actor',

			Orte: 'Location',
			Plätze: 'Location',
			Gebiete: 'Location',
			Regionen: 'Location',
			Karten: 'Location',
			Schauplätze: 'Location',

			Fraktionen: 'Faction',
			Organisationen: 'Faction',
			Gruppen: 'Faction',
			Gilden: 'Faction',
			Konzerne: 'Faction',
			Häuser: 'Faction',

			Gegenstände: 'Item',
			Ausrüstung: 'Item',
			Schatz: 'Item',
			Artefakte: 'Item',
			'Magische Gegenstände': 'Item',

			Handlungen: 'Plot',
			Geschichten: 'Plot',
			Abenteuer: 'Plot',
			Mysterien: 'Plot',
			Kampagnen: 'Plot',
			Erzählungen: 'Plot',
			Fäden: 'Plot',
			Bögen: 'Plot',

			Ereignisse: 'Event',
			Begebenheiten: 'Event',
			Vorfälle: 'Event',
			Zeitleiste: 'Timeline',
			Chronologie: 'Timeline',
			Geschichte: 'Timeline',

			Szenen: 'Scene',
			Begegnungen: 'Scene',
			Situationen: 'Scene',
			Sitzungen: 'Session',
			Spielsitzungen: 'Session',

			Geheimnisse: 'Secret',
			'Verborgene Informationen': 'Secret',
			'SL-Notizen': 'Secret',
			Vertraulich: 'Secret',

			Hinweise: 'Clue',
			Beweise: 'Clue',
			Spuren: 'Clue',
			Zeichen: 'Clue',

			Handouts: 'Handout',
			Dokumente: 'Handout',
			Flugblätter: 'Handout',
			Broschüren: 'Handout',

			Beziehungen: 'Relationship',
			Verbindungen: 'Relationship',
			Politik: 'Relationship',
			Allianzen: 'Relationship',
			Bindungen: 'Relationship',

			Regeln: 'Rule',
			Mechaniken: 'Rule',
			Systeme: 'Rule',

			Tabellen: 'Table',
			Zufallstabellen: 'Table',
			Diagramme: 'Table',
			Generatoren: 'Table',
			Listen: 'Table',

			Medien: 'Media',
			Bilder: 'Media',
			Audio: 'Media',
			Musik: 'Media',
			Videos: 'Media',

			Decks: 'Deck',
			Präsentationen: 'Deck',
			Folien: 'Deck',

			Notizen: 'Note',
			Informationen: 'Note',
			Details: 'Note',
			Verschiedenes: 'Note'
		}
	}
];

export class HeaderMappingSystem {
	private gameSystemConfigs: Map<string, GameSystemConfig> = new Map();
	private languageConfigs: Map<string, LanguageConfig> = new Map();
	private campaignConfigs: Map<string, CampaignConfig> = new Map();
	/**
	 * `resolveHeader` runs once per heading, and rebuilding the merged mapping each time was
	 * most of the parse. Every mutator clears it; a config object mutated in place after
	 * registering (e.g. the one `exportCampaignConfig` hands out) is not seen — re-register it.
	 */
	private resolveCache = new Map<
		string | undefined,
		{ mappings: HeaderMapping; lower: Map<string, ElementType> }
	>();

	constructor() {
		// Load default configurations
		GAME_SYSTEM_CONFIGS.forEach((config) => {
			this.gameSystemConfigs.set(config.id, config);
		});

		LANGUAGE_CONFIGS.forEach((config) => {
			this.languageConfigs.set(config.locale, config);
		});
	}

	/**
	 * Register a new game system configuration
	 */
	registerGameSystem(config: GameSystemConfig): void {
		this.resolveCache.clear();
		this.gameSystemConfigs.set(config.id, config);
	}

	/**
	 * Register a new language configuration
	 */
	registerLanguage(config: LanguageConfig): void {
		this.resolveCache.clear();
		this.languageConfigs.set(config.locale, config);
	}

	/**
	 * Register a campaign configuration
	 */
	registerCampaign(config: CampaignConfig): void {
		this.resolveCache.clear();
		this.campaignConfigs.set(config.id, config);
	}

	/**
	 * Get the resolved header mappings for a specific campaign
	 */
	getHeaderMappings(campaignId?: string): HeaderMapping {
		let mappings: HeaderMapping = {};

		// Start with base English mappings
		mappings = { ...BASE_ENGLISH_MAPPINGS };

		const campaign = campaignId ? this.campaignConfigs.get(campaignId) : null;

		// Apply language mappings
		const languageId = campaign?.language || 'en';
		const languageConfig = this.languageConfigs.get(languageId);
		if (languageConfig) {
			mappings = { ...mappings, ...languageConfig.headerMappings };
		}

		// Apply game system mappings
		const gameSystemId = campaign?.gameSystem;
		const gameSystemConfig = gameSystemId ? this.gameSystemConfigs.get(gameSystemId) : null;
		if (gameSystemConfig) {
			mappings = { ...mappings, ...gameSystemConfig.headerMappings };
		}

		// Apply campaign-specific overrides
		if (campaign?.customMappings) {
			mappings = { ...mappings, ...campaign.customMappings };
		}

		// Remove disabled mappings
		if (campaign?.disabledMappings) {
			campaign.disabledMappings.forEach((header) => {
				delete mappings[header];
			});
		}

		return mappings;
	}

	/**
	 * Resolve header text to element type
	 */
	resolveHeader(headerText: string, campaignId?: string): ElementType | undefined {
		let cached = this.resolveCache.get(campaignId);
		if (!cached) {
			const mappings = this.getHeaderMappings(campaignId);
			// First key in insertion order wins per lowercased form — what the old linear
			// case-insensitive scan returned when two keys differ only by case.
			const lower = new Map<string, ElementType>();
			for (const [key, value] of Object.entries(mappings)) {
				const k = key.toLowerCase();
				if (!lower.has(k)) lower.set(k, value);
			}
			cached = { mappings, lower };
			this.resolveCache.set(campaignId, cached);
		}

		// Exact match first, on the plain object as before (prototype keys included).
		if (cached.mappings[headerText]) {
			return cached.mappings[headerText];
		}
		return cached.lower.get(headerText.toLowerCase());
	}

	/**
	 * Get all available header options for a campaign
	 */
	getAvailableHeaders(campaignId?: string): { header: string; type: ElementType }[] {
		const mappings = this.getHeaderMappings(campaignId);
		return Object.entries(mappings).map(([header, type]) => ({ header, type }));
	}

	/**
	 * Get headers by element type
	 */
	getHeadersByType(elementType: ElementType, campaignId?: string): string[] {
		const mappings = this.getHeaderMappings(campaignId);
		return Object.entries(mappings)
			.filter(([, type]) => type === elementType)
			.map(([header]) => header);
	}

	/**
	 * Create a campaign configuration from existing campaign
	 */
	createCampaignConfig(
		campaignId: string,
		name: string,
		baseConfig?: {
			gameSystem?: string;
			language?: string;
			customMappings?: HeaderMapping;
		}
	): CampaignConfig {
		const config: CampaignConfig = {
			id: campaignId,
			name,
			...baseConfig
		};

		this.registerCampaign(config);
		return config;
	}

	/**
	 * Update campaign mappings
	 */
	updateCampaignMappings(
		campaignId: string,
		updates: {
			customMappings?: HeaderMapping;
			disabledMappings?: string[];
			gameSystem?: string;
			language?: string;
		}
	): void {
		const existing = this.campaignConfigs.get(campaignId);
		if (existing) {
			this.resolveCache.clear();
			this.campaignConfigs.set(campaignId, {
				...existing,
				...updates
			});
		}
	}

	/**
	 * Export campaign configuration
	 */
	exportCampaignConfig(campaignId: string): CampaignConfig | undefined {
		return this.campaignConfigs.get(campaignId);
	}

	/**
	 * Import campaign configuration
	 */
	importCampaignConfig(config: CampaignConfig): void {
		this.registerCampaign(config);
	}
}

// Singleton instance
export const headerMappingSystem = new HeaderMappingSystem();

// Example usage:
/*
// Create a campaign configuration
const campaignConfig = headerMappingSystem.createCampaignConfig(
  'my-vampire-campaign',
  'Nights of New Orleans',
  {
    gameSystem: 'vampire_masquerade',
    language: 'en',
    customMappings: {
      'The Camarilla': 'Faction',
      'Blood Dolls': 'Actor',
      'Haven': 'Location'
    },
    disabledMappings: ['Equipment'] // Vampires don't need much gear
  }
);

// Resolve headers for this campaign
const elementType = headerMappingSystem.resolveHeader('Kindred', 'my-vampire-campaign');
// Returns: 'Actor'

const elementType2 = headerMappingSystem.resolveHeader('Haven', 'my-vampire-campaign');
// Returns: 'Location'

// Get all available headers for autocomplete
const availableHeaders = headerMappingSystem.getAvailableHeaders('my-vampire-campaign');
*/
