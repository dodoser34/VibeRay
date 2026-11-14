"""Настройки городов для скриптов геоданных: откуда брать районы и какие ручные правки границ есть.

Город с официальным делением в OSM (Санкт-Петербург, Кёльн, Бристоль):

    query      запрос Overpass, который находит отношения-границы районов;
    districts  slug района → точное значение тега name его отношения в OSM;
    bays       (необязательно) заливы с зубцами, закрытые прямой по просьбе пользователя:
               кусок района from между хордой и границей района to отходит району to;
    fills      (необязательно) провалы между зубцами границы, закрытые линией по просьбе
               пользователя: земля за городом между линией и районом district отходит району;
               концы и изломы линии — вершины района (так же присоединяется отдельный кусок);
    drops      (необязательно) отдельные куски района далеко за городом, которые пользователь
               попросил убрать: point — точка внутри куска.

Город без официального деления (Костанай) собирается из кварталов:

    blocks     slug-и районов; затравка — текущий districts.geojson (или --seed);
    closures   отрезки между узлами OSM там, где пользователь провёл границу, а линии OSM нет;
    bump_m     выступ района уже двух таких радиусов, торчащий в пустую землю, отрезается;
    bumps      точки внутри более широких выступов, которые пользователь попросил убрать.

У любого города: note — откуда взяты районы; эта строка попадает в city.json.

Состав районов меняется только с согласия пользователя. Ручная правка (bays, fills, drops, closures,
bumps) — тоже
только по его разметке: дата в комментарии помогает найти, откуда она взялась.
"""

CITIES = {
    'saint-petersburg': {
        'query': (
            'area["name"="Санкт-Петербург"]["admin_level"="4"]->.a;'
            'relation(area.a)["boundary"="administrative"]["admin_level"="5"];'
        ),
        'districts': {
            'admiralteysky': 'Адмиралтейский район',
            'vasileostrovsky': 'Василеостровский район',
            'vyborgsky': 'Выборгский район',
            'kalininsky': 'Калининский район',
            'kirovsky': 'Кировский район',
            'kolpinsky': 'Колпинский район',
            'krasnogvardeysky': 'Красногвардейский район',
            'krasnoselsky': 'Красносельский район',
            'kronshtadtsky': 'Кронштадтский район',
            'kurortny': 'Курортный район',
            'moskovsky': 'Московский район',
            'nevsky': 'Невский район',
            'petrogradsky': 'Петроградский район',
            'petrodvortsovy': 'Петродворцовый район',
            'primorsky': 'Приморский район',
            'pushkinsky': 'Пушкинский район',
            'frunzensky': 'Фрунзенский район',
            'tsentralny': 'Центральный район',
        },
        'note': (
            'Районы — 18 административных районов Санкт-Петербурга в официальных границах '
            'OpenStreetMap (boundary=administrative, admin_level=5): вершины OSM без упрощения и '
            'сглаживания, вырезана только вода. Вода и улицы — тоже OpenStreetMap (ODbL).'
        ),
    },
    'cologne': {
        'query': (
            'area["name"="Köln"]["admin_level"="6"]->.a;'
            'relation(area.a)["boundary"="administrative"]["admin_level"="9"];'
        ),
        'districts': {
            'innenstadt': 'Innenstadt',
            'rodenkirchen': 'Rodenkirchen',
            'lindenthal': 'Lindenthal',
            'ehrenfeld': 'Ehrenfeld',
            'nippes': 'Nippes',
            'chorweiler': 'Chorweiler',
            'porz': 'Porz',
            'kalk': 'Kalk',
            'muelheim': 'Mülheim',
        },
        # Залив с зубцами на границе Эренфельда и Ниппеса у Хбф закрыт прямой между вершинами
        # зубцов (разметка пользователя 2026-11-10): залив отходит Эренфельду.
        'bays': [
            {
                'from': 'nippes',
                'to': 'ehrenfeld',
                'chord': [[6.9371207, 50.9594616], [6.940027, 50.9574462]],
            },
        ],
        'note': (
            'Районы — 9 городских округов Кёльна (Stadtbezirke) в официальных границах '
            'OpenStreetMap (boundary=administrative, admin_level=9): вершины OSM без упрощения и '
            'сглаживания, вырезана только вода; залив с зубцами между Эренфельдом и Ниппесом '
            'закрыт прямой. Вода и улицы — тоже OpenStreetMap (ODbL).'
        ),
    },
    'bristol': {
        'query': (
            'relation["boundary"="political"]["political_division"="ward"]'
            '(51.33,-3.13,51.56,-2.48);'
        ),
        'districts': {
            'ashley': 'Ashley Ward',
            'avonmouth': 'Avonmouth & Lawrence Weston Ward',
            'bedminster': 'Bedminster Ward',
            'bishopston': 'Bishopston & Ashley Down Ward',
            'bishopsworth': 'Bishopsworth Ward',
            'brislington-east': 'Brislington East Ward',
            'brislington-west': 'Brislington West Ward',
            'bristol-central': 'Central Ward',
            'clifton': 'Clifton Ward',
            'clifton-down': 'Clifton Down Ward',
            'cotham': 'Cotham Ward',
            'easton': 'Easton Ward',
            'eastville': 'Eastville Ward',
            'filwood': 'Filwood Ward',
            'frome-vale': 'Frome Vale Ward',
            'hartcliffe': 'Hartcliffe & Withywood Ward',
            'henbury': 'Henbury & Brentry Ward',
            'hengrove': 'Hengrove & Whitchurch Park Ward',
            'hillfields': 'Hillfields Ward',
            'horfield': 'Horfield Ward',
            'hotwells': 'Hotwells & Harbourside Ward',
            'knowle': 'Knowle Ward',
            'lawrence-hill': 'Lawrence Hill Ward',
            'lockleaze': 'Lockleaze Ward',
            'redland': 'Redland Ward',
            'southmead': 'Southmead Ward',
            'southville': 'Southville Ward',
            'st-george-central': 'St George Central Ward',
            'st-george-troopers-hill': 'St George Troopers Hill Ward',
            'st-george-west': 'St George West Ward',
            'stockwood': 'Stockwood Ward',
            'stoke-bishop': 'Stoke Bishop Ward',
            'westbury-on-trym': 'Westbury-on-Trym & Henleaze Ward',
            'windmill-hill': 'Windmill Hill Ward',
        },
        'note': (
            'Районы — 34 избирательных округа Бристоля (wards) в официальных границах '
            'OpenStreetMap (boundary=political, political_division=ward): вершины OSM без '
            'упрощения и сглаживания, вырезана только вода. Вода и улицы — тоже OpenStreetMap '
            '(ODbL).'
        ),
    },
    # Состав — все 6 районов из OSM (admin_level=6 внутри границы города), утверждён
    # пользователем 2026-11-14.
    'astana': {
        'query': (
            'area(id:3603087155)->.a;'
            'relation(area.a)["boundary"="administrative"]["admin_level"="6"];'
        ),
        'districts': {
            'almaty-district': 'Алматы ауданы',
            'baikonur': 'Байқоңыр ауданы',
            'esil': 'Есіл ауданы',
            'nura': 'Нұра ауданы',
            'saraishyk': 'Сарайшық ауданы',
            'saryarka': 'Сарыарқа ауданы',
        },
        # Провалы между зубцами северной границы Байконура закрыты прямыми по вершинам OSM,
        # отдельный кусок на северо-западе присоединён (разметка пользователя 2026-11-14).
        'fills': [
            {
                'district': 'baikonur',
                'line': [
                    [71.3032624, 51.2358777],  # стык с Сарыаркой
                    [71.2980936, 51.272763],  # западный угол отдельного куска
                    [71.3201952, 51.2953906],  # его верхний угол
                    [71.3556138, 51.2977218],  # верхний левый угол высокого зубца
                ],
            },
            {
                'district': 'baikonur',
                'line': [[71.3888316, 51.2926189], [71.4759015, 51.2864099]],
            },
            {
                'district': 'baikonur',
                'line': [[71.4856214, 51.2739615], [71.584252, 51.2694831]],
            },
        ],
        # Эксклавы далеко за городом убраны (разметка пользователя 2026-11-14).
        'drops': [
            {'district': 'baikonur', 'point': [71.6657, 51.3303]},
            {'district': 'almaty-district', 'point': [71.7689, 51.1539]},
        ],
        'note': (
            'Районы — 6 административных районов Астаны в официальных границах OpenStreetMap '
            '(boundary=administrative, admin_level=6): вершины OSM без упрощения и сглаживания, '
            'вырезана вода; провалы на северной границе Байконура закрыты прямыми, эксклавы '
            'Байконура и района Алматы за городом убраны. Вода и улицы — тоже OpenStreetMap (ODbL).'
        ),
    },
    'kostanay': {
        'blocks': [
            'center',
            'vokzal',
            'narimanovka',
            'zapadny',
            'kzhbi',
            'khimik',
            'amangeldy',
            'dostyk',
            'kostanay-2',
            'aeroport',
            'perevalovka',
            'ksk',
            'zelenstroy',
            'uzkaya-koleya',
        ],
        # Замыкающие отрезки: там, где пользователь провёл границу, а линии OSM нет (2026-11-10).
        # Концы — узлы OSM (вершины районов) или точка в 2 м за линией OSM: отрезок её пересечёт.
        'closures': [
            # Север Костаная-2: от дороги KP-4 к концу ж/д тупика, между тупиками и через выемку
            # к северо-восточному углу района.
            [[63.5365347, 53.2435922], [63.54471, 53.2483071]],
            [[63.54471, 53.2483071], [63.5423765, 53.2514269]],
            [[63.5423765, 53.2514269], [63.5542235, 53.2626708]],
            # Полоса Узкой Колеи между Костанаем-2 и Привокзальным отрезана от района.
            [[63.6258151, 53.2421489], [63.626495, 53.2417321]],
            # Узкие пальцы Достыка и Химика внутри Амангельды отрезаны у основания.
            [[63.5529387, 53.1404556], [63.5530109, 53.1407087]],
            [[63.6006967, 53.1515484], [63.600884, 53.151124]],
            # Дорога Химика, торчащая в Амангельды, отрезана по границе районов.
            [[63.5812923, 53.1539738], [63.5835962, 53.1550719]],
            # Полоса КСК вдоль дороги в Зеленстрое отделена от квартала, к которому примыкает.
            [[63.6816343, 53.2541912], [63.6817439, 53.254228]],
        ],
        'bump_m': 40,  # выступ района уже 80 м в пустую землю — не район (разметка 2026-11-13)
        # Выступы шире, показанные пользователем на скриншоте: точка внутри выступа.
        'bumps': [[63.5486, 53.2213]],
        'note': (
            'Районы — 14 жилых районов Костаная. Официального деления в OpenStreetMap нет, поэтому '
            'город разрезан на кварталы линиями OSM (улицы, железная дорога, берега, контуры зон '
            'застройки), и каждый квартал целиком входит в один район: любая граница района лежит '
            'на линии OSM. Вырезана только вода. Вода и улицы — тоже OpenStreetMap (ODbL).'
        ),
    },
}
