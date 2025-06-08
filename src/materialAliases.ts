/**
 * Maps the normalized skin names (lowercase, no spaces) to their corresponding VMAT pattern name.
 * The key is what will be extracted from the skin name (e.g., "pole position" -> "poleposition").
 * The value is the actual pattern name used in the VMAT files (e.g., "cu_cz75_precision").
 */
export const MATERIAL_ALIASES: Record<string, string> = {
    // Weapon Skins
    //CZ
    cz75autovictoria: 'aq_etched_cz75',
    cz75autothefuschiaisnow: 'am_fuschia', //intentional spelling mistake
    cz75autoxiangliu: 'gs_cz_snakes_purple',
    cz75autoyellowjacket: 'cu_cz75a_chastizer',
    cz75autochalice: 'am_royal', //broken
    cz75autotreadplate: 'am_diamond_plate', //half broken
    cz75autosyndicate: 'gs_train_cz75',
    cz75autoslalom: 'cu_abstract_white_cz',
    cz75autoeco: 'cu_cz75_eco',
    cz75autotigris: 'cu_c75a-tiger',
    cz75autotacticat: 'cz75_tacticat',
    cz75autopoleposition: 'cu_cz75_precision',
    cz75autoredastor: 'gs_cz75a_redastor',
    cz75autoemeraldquartz: 'am_crystallized_green', //half broken
    cz75autoemerald: 'an_emerald', //broken
    cz75autopoisondart: 'am_nitrogen', //half broken
    cz75autotwist: 'am_gyrate', //half broken
    cz75autohexane: 'hy_bluehex', //half broken
    cz75autocrimsonweb1: 'hy_webs', //broken
    cz75autovendetta: 'gs_cz75_vendetta',
    cz75autotuxedo: 'so_orca', //broken
    cz75autonitro: 'so_orange_accents2', //broken
    cz75autocircaetus: 'cu_cz75_whirlwind',
    cz75autopolymer: 'am_czv2_mf', //half broken
    cz75autoimprint: 'gs_cz75_tread',
    cz75autodistressed: 'cu_cz75_cerakote',
    cz75autosilver: 'an_silver', //broken
    cz75autocopperfiber: 'am_carbon_fiber', //broken
    cz75automidnightpalm: 'sp_palm_night', //broken
    cz75autogreenplaid: 'hy_plaid2', //broken
    cz75autoarmysheen: 'am_army_shine', //broken
    cz75autoindigo: 'so_indigo_and_grey', //broken
    cz75autojungledashed: 'sp_tape_short_jungle', //broken
    cz75autopinkpearl: 'soe_pink_pearl', //broken
    cz75autoframework: 'hy_vertigoillusion', //half broken
    
    // Deagle
    deserteaglegoldenkoi: 'am_scales_bravo', //broken
    deserteagleprintstream: 'cu_deag_printstream',
    deserteaglecodered: 'gs_deagle_aggressor',
    deserteagleoceandrive: 'cu_deagle_kitch',
    deserteaglefennecfox: 'gs_deagle_fennec',
    deserteaglehypnotic: 'aa_vertigo', //broken
    deserteaglecobaltdisruption: 'am_ddpatdense_peacock', //broken
    deserteaglestarcade: 'cu_glitter_deagle',
    deserteaglekumichodragon: 'aq_deserteagle_kumichodragon',
    deserteagleconspiracy: 'cu_deagle_aureus',
    deserteaglemechaindustries: 'gs_deagle_mecha',
    deserteagleheattreated: 'aq_deagle_case_hardened_2', //broken
    deserteagleblaze: 'aa_flames', //broken
    deserteagleemeraldjrmungandr: 'am_jorm_green',
    deserteaglesunsetstorm: 'am_seastorm_blood', //broken
    deserteaglesunsetstorm2: 'am_seastorm_shojo', //broken
    deserteaglehandcannon: 'aq_handcannon',
    deserteaglepilot: 'aq_pilot_deagle',
    deserteaglemulberry: 'soe_plum',
    deserteaglecrimsonweb2: 'hy_webs_darker', //broken and update handling skins with the same name
    deserteagleheirloom: 'aq_engraved_deagle',
    deserteaglenaga: 'aq_deagle_naga',
    deserteaglelightrail: 'gs_deagle_exo',
    deserteagleserpentstrike: 'deagle_snake_pattern', //broken
    deserteagletriggerdiscipline: 'cu_deag_trigger_discipline',
    deserteagledirective: 'aq_desert_eagle_constable',
    deserteaglenightheist: 'am_heist_plans_purple', //broken
    deserteaglemintfan: 'ht_earth_fans', //broken
    deserteaglesputnik: 'sp_spacerace_blue', //broken
    deserteaglemeteorite: 'am_crystallized_dark', //broken
    deserteagleurbanrubble: 'hy_varicamo_urban', //broken
    deserteagleoxideblaze: 'cu_desert_eagle_corroden',
    deserteaglecorinthian: 'aq_deagle_corinthian',
    deserteagleblueply: 'cu_deagle_replica',
    deserteaglebronzedeco: 'am_bronze_sparkle', //broken
    deserteaglecalligraffiti: 'deagle_calligraff',
    deserteaglemidnightstorm: 'am_seastorm', //broken
    deserteaglenight: 'so_night',
    deserteaglethebronze: 'am_numbers_bronze', //broken
    deserteagleurbanddpat: 'hy_ddpat_urb', //broken
    deserteagletilted: 'cu_overpass_aqua_deagle',
    deserteaglemudder: 'hy_mottled_sand', //broken

    // Dualies
    dualberettascobrastrike: 'gs_dualberettas_cobra',
    dualberettastwinturbo: 'cu_dual_elites_rally',
    dualberettasmelondrama: 'cu_elites_beware',
    dualberettasduelist: 'gs_mother_of_pearl_elite',
    dualberettashemoglobin: 'am_ossify_red', //broken
    dualberettasdemolition: 'so_tangerine',
    dualberettasmarina: 'hy_marina_sunrise', //broken
    dualberettassweetlittleangels: 'cu_overpass_baby_dualies',
    dualberettasdezastre: 'gs_dual_elites_dezastre',
    dualberettasurbanshock: 'cu_elites_urbanstorm',
    dualberettashydrostrike: 'dual_elite_hydro_strike',
    dualberettasroyalconsorts: 'gs_dual_berettas_golden_venice', //sort of broken, parts aren't gold
    dualberettasfloracarnivora: 'cu_dual_elites_evil_flora',
    dualberettascobaltquartz: 'am_crystallized_blue', //broken
    dualberettasemeraldemerald: 'an_emerald', //already handled in CZ75, still broken
    dualberettasblacklimba: 'cu_season_elites_bravo',
    dualberettasretribution: 'cu_retribution',
    dualberettasanodizednavy: 'an_navy', //broken
    dualberettaspanther: 'so_panther',
    dualberettasbalance: 'gs_dual_elites_rose',
    dualberettastread: 'gs_dual_berettas_tread',
    dualberettascartel: 'aq_dualberettas_cartel',
    dualberettasshred: 'sp_elites_winter_raider', //broken
    dualberettaselite16:'gs_dual_elites_classic',
    dualberettasventilators: 'gs_dualberettas_ventilators',
    dualberettashideout: 'dual_berettas_lethal_grin',
    dualberettaspyre: 'hy_gelpen_dark', //broken
    dualberettasswitchboard: 'hy_numbers_green', //broken
    dualberettasrosenacre: 'soo_rose_gold', //broken
    dualberettaspolishedmalachite: 'soch_marble_grips', //broken
    dualberettasstained: 'aq_forced', //figure out patterns
    dualberettasdriftwood: 'sp_dry_wood', //broken
    dualberettasmooninlibra: 'hy_zodiac1', //broken
    dualberettasbriar: 'hy_vines', //broken
    dualberettasheist: 'am_heist_plans_green', //broken
    dualberettasbordeux: 'soch_acrylic_grips', //broken
    dualberettascolony: 'so_space_marine', //check if the name is correct
    dualberettasoilchange: 'sp_engine_dirty', //broken
    dualberettascontractor: 'so_pmc', //check if the name is correct

    // Five-SeveN
    fivesevenhyperbeast: 'cu_fiveseven_hyperbeast',
    fivesevenangrymob: 'cu_five_seven_angry',
    fivesevenfallhazard: 'cu_vertigo_fiveseven',
    fivesevenfairytale: 'cu_five_seven_diary',
    fivesevenmonkeybusiness: 'cu_fiveseven_banana',
    fivesevenfowlplay: 'aq_57_feathers',
    fivesevenneonkimono: 'hy_kimono_diamonds', //broken
    fivesevenberriesandcherries: 'aa_fade_red_blue', //broken
    fivesevencasehardened: 'aq_oiled', //half broken
    fivesevencoppergalaxy: 'am_copper_flecks', //broken
    fivesevenheattreated: 'aq_case_hardened_fiveseven', //broken
    fiveseventriumvirate: 'cu_fiveseven_augmented',
    fivesevenboostprotocol: 'gs_five_seven_efusion',
    fivesevenhybrid: 'fiveseven_hybrid',
    fivesevenretrobution: 'cu_fiveseven_retrobution',
    fivesevenbuddy: 'cu_fiveseven_gsg9',
    fivesevencrimsonblossom: 'hy_bud_red', //broken
    fivesevennitro: 'so_orange_accents', //broken
    fivesevennightshade: 'hy_flowers', //broken
    fivesevenkami: 'hy_kami', //broken
    fivesevenurbanhazard: 'cu_fiveseven_urban_hazard',
    fivesevensilverquartz: 'am_crystallized_silver', //broken
    fivesevencapillary: 'cu_fiveseven_vein',
    fivesevenviolentdaimyo: 'cu_five_seven_daimyo',
    fivesevenscumbria: 'aq_five_seven_scumbria', //broken
    fivesevenflametest: 'gs_fiveseven_hot_rod_violet',
    fivesevenscrawl: 'cu_fiveseven_alpha_omega',
    fivesevencandyapple: 'so_red', //broken
    fivesevenhotshot: 'so_grey_nuclear_orange_five_seven', //broken
    fivesevenskyblue: 'soe_blue_and_chrome',  //broken
    fivesevenmidnightpaintover: 'hy_overpass_paintover_teal', //broken
    fivesevenorangepeel: 'sp_tape_orange', //broken
    fivesevenwitheredvine: 'sp_moro_textile_purple_yellow', //broken
    fivesevenanodizedgunmetal: 'an_gunmetal_bravo', //broken
    fivesevenjungle: 'so_jungle', //broken
    fivesevencontractor: 'so_pmc', //already handled in Dualies, but check if the name is correct
    fivesevenautumnthicket: 'soo_branches', //broken
    fivesevenforestnight: 'hy_forest_night', //broken
    fivesevencoolant: 'hy_ducts_green', //broken

    //Glock-18
    glock18gammadopplerphase1: 'am_gamma_doppler_phase1_glock', //broken
    glock18gammadopplerphase2: 'am_gamma_doppler_phase2_glock', //broken
    glock18gammadopplerphase3: 'am_gamma_doppler_phase3_glock', //broken
    glock18gammadopplerphase4: 'am_gamma_doppler_phase4_glock', //broken
    glock18gammadoppleremerald: 'am_emerald_marbleized_glock', //broken
    glock18neonoir: 'cu_glock_noir',
    glock18goldtoof: 'glock_chomper',
    glock18bulletqueen: 'cu_glock18_warmaiden',
    glock18wastelandrebel: 'cu_glock_wasteland_rebel',
    glock18twilightgalaxy: 'am_aqua_flecks', //broken
    glock18axia: 'gsch_axia_glock',
    glock18waterelemental: 'cu_glock-liquescent',
    glock18snackattack: 'cu_glock_snackattack',
    glock18shinobu: 'glock_shinobu',
    glock18vogue: 'cu_glock_eyecontact',
    glock18fade: 'aa_fade', //broken
    glock18synthleaf: 'hy_leaf_blue', //broken
    glock18dragontattoo: 'am_dragon_glock', //broken
    glock18franklin: 'cu_money_glock',
    glock18brass: 'aq_brass', //broken
    glock18glockingbird: 'spe_missile', //broken
    glock18steeldisruption: 'am_ddpatdense_silver',
    glock18ramesesreach: 'cu_glock_ramzes',
    glock18royallegion: 'gs_glock18_award',
    glock18pinkddpat: 'hy_ddpat_pink', //broken
    glock18grinder: 'aq_glock_coiled', //figure our masks
    glock18nucleargarden: 'am_nuclear_skulls_green', //broken
    glock18block18: 'glock_brick_mondrian',
    glock18moonrise: 'aa_glock_18_urban_moon_fever', //broken
    glock18weasel: 'cu_glock18_weasel',
    glock18umbralrabbit: 'cu_glock_moon_rabbit',
    glock18reactor: 'am_nuclear_pattern1_glock', //broken
    glock18coralbloom: 'soe_roses', //broken
    glock18bluefissure: 'hy_craquelure', //broken
    glock18candyapple: 'so_red', //broken
    glock18tealgraf: 'hy_overpass_tagged_teal', //broken
    glock18bunsenburner: 'aq_glock18_flames_blue', //half broken
    glock18catacombs: 'cu_glock_deathtoll', //broken
    glock18greenline: 'glock_train_green',
    glock18warhawk: 'gs_glock_thunder_dust',
    glock18wraiths: 'gs_glock18_wrathys',
    glock18ironwork: 'aq_glock_dark-fall',
    glock18clearpolymer: 'gs_glock_polymer',
    glock18sacrifice: 'cu_glock_hero',
    glock18sanddune: 'so_sand_bravo', //broken
    glock18groundwater: 'so_olive', //broken
    glock18night: 'so_night', //broken
    glock18redtire: 'sp_tire_tread_red', //broken
    glock18oceantopo: 'hye_topo', //broken
    glock18highbeam: 'aa_vertigo_blue', //broken

    // P2000
    p2000fireelemental: 'cu_p2000_fire_elemental',
    p2000oceanfoam: 'am_ossify_blue_p2000_bravo', //broken
    p2000corticera: 'cu_favela_p2000',
};