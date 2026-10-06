'use strict';
/* السبرايتات: خرائط بكسل نصية. المفاتيح معرّفة في pix.js
   J: ogGjJ  L: alLiI  M: dmMqQ  H: rhHpP  T: stTuU  C: vcCwW  F: zxXbB  (من الأغمق للأفتح) */
var ART = (function () {
  var S = PIX.sprite;
  var A = {};

  /* الجبّون: معلّق بيدين على غصن (وضع جاهز) */
  A.GIB_HANG = S([
    '...ccc.........ccc...',
    '...cwc.........cwc...',
    '...ccc.........ccc...',
    '...xXb.........bXx...',
    '...xXb.........bXx...',
    '...xXb..xXXXx..bXx...',
    '...xXb.xXbbbXx.bXx...',
    '...xXb.xcwwwcx.bXx...',
    '...xXb.xcowocx.bXx...',
    '...xXb.xcwwwcx.bXx...',
    '...xXb.xcwxwcx.bXx...',
    '....xXb.xXXXx.bXx....',
    '.....xXbXXXXXbXx.....',
    '.....xXXbbbbbXXx.....',
    '......xXbbbbbXx......',
    '.......xXbbbXx.......',
    '.......xXbbbXx.......',
    '.......xXbbbXx.......',
    '......xXx...xXx......',
    '......xXb...bXx......',
    '......xXb...bXx......',
    '......xXb...bXx......',
    '......xbb...bbx......',
    '.......cc...cc.......',
    '......ccc...ccc......'
  ]);

  /* أوراق صغيرة تتكدّس منها الأشجار */
  A.LEAF_S = [
    S([
      '..gggg...',
      '.gGGGGg..',
      'gGGjGGGg.',
      '.gGGGGGgg',
      '..gGGGg..',
      '...ggg...'
    ]),
    S([
      '...gg....',
      '..gGGg...',
      '.gGjGGgg.',
      'gGGjGGGGg',
      '.gGGGGGg.',
      '..gggg...'
    ]),
    S([
      '.gg......',
      'gGGgg....',
      'gGjGGgg..',
      '.gGGjGGgg',
      '..gGGGGg.',
      '...gggg..'
    ])
  ];

  /* سعفة طويلة نازلة */
  A.FROND = S([
    '.gg..',
    'gGGg.',
    'gGjGg',
    '.gGjg',
    '.gGGg',
    '..gGg',
    '..gjg',
    '..gGg',
    '...gg'
  ]);

  /* ورقة كبيرة: نص علوي ويتعكس عموديًا */
  A.LEAF_BIG = S(PIX.mirrorV([
    '..........gggggggggg..........',
    '.......gggGGGGGGGGGGggg.......',
    '....ggGGGGGGGGGGGGGGGGGgg.....',
    '..ggGGGGjGGGGGjGGGGGjGGGGgg...',
    '.gGGGGGGGjGGGGjGGGGjGGGGGGGgg.',
    'gGGGGGGGGGjjGGjGGjjGGGGGGGGGGg',
    'gGGjjjjjjjjjjjjjjjjjjjjjjjjjjg'
  ]));

  /* فطر متوهج */
  A.MUSH = S([
    '..hHHh..',
    '.hHpHHh.',
    'hHHHpHHh',
    '.hhhhhh.',
    '...cw...',
    '...cw...'
  ]);

  /* قطرة ندى */
  A.DROP = S([
    '..u..',
    '.uWu.',
    'uUWUt',
    'uUUUt',
    '.ttt.'
  ], { outlineId: PIX.CH.s });

  /* مانجو */
  A.MANGO = S([
    '...gL...',
    '..mMMm..',
    '.mMqQMm.',
    'mMqQQMMm',
    'mMqQMMmm',
    '.mMMMmm.',
    '..mmmm..'
  ], { outlineId: PIX.CH.d });

  /* فاكهة وردية بقشور خضراء */
  A.PITAYA = S([
    '..L..L..',
    '...LL...',
    '.hHHHHh.',
    'hHpPpHHh',
    'hHPpPpHh',
    'hHpPpHHh',
    '.hHHHHh.',
    '..hhhh..'
  ], { outlineId: PIX.CH.r });

  /* أوراق متكدّسة وحلقة (من خرائط foliage.js) */
  A.CL = {};
  Object.keys(FOLIAGE_MAPS).forEach(function (k) {
    if (k !== 'ring') A.CL[k] = S(FOLIAGE_MAPS[k], { outline: false });
  });
  A.RING = S(FOLIAGE_MAPS.ring, { outlineId: PIX.CH.o });

  /* طائر وردي واقف */
  A.BIRD = S([
    '...hHH......',
    '..hHHHh.....',
    '.dhHoHHh....',
    'ddhHHHHHh...',
    '..hHpHHHHh..',
    '..hHppppHhhh',
    '...hHpppHHhh',
    '....hHHHHhh.',
    '.....dd.dd..'
  ]);

  /* عش منسوج */
  A.NEST = S([
    '....mmmmmmmm....',
    '..mmMMqMMqMMmm..',
    '.mMqMMMqMMMqMMm.',
    'mMMqMqMMMqMqMMMm',
    'dmMMMqMqMqMMMMmd',
    '.dmmMMMMMMMMmmd.',
    '...ddmmmmmmdd...'
  ], { outlineId: PIX.CH.d });
  /* طير يطير: إطاران */
  A.BIRDF = [
    S(['h.....h','.hh.hh.','..hhh..'], { outline: false }),
    S(['..hhh..','.hh.hh.','h.....h'], { outline: false })
  ];

  /* أبو قرن (يشيل الحلقات المتحركة): إطاران، يواجه اليمين */
  function padRows(rows) { var w = 0; rows.forEach(function (r) { if (r.length > w) w = r.length; }); return rows.map(function (r) { while (r.length < w) r += '.'; return r; }); }
  A.HORN = [
    S(padRows([
      '.gg....gg.....',
      '..ggo.ggo.....',
      '..gggoggg..qq.',
      '...ggggggoqMMm',
      '..oggggggwMMMm',
      '.ogoggwwwwqMm.',
      '..o.gwwww.....',
      '.....c.c......'
    ])),
    S(padRows([
      '..............',
      '.....ggg..qq..',
      '...gggggggqMMm',
      '..ogggggggMMMm',
      '.ogoggwwwwqMm.',
      '..ggggwwww....',
      '.gg.ggc.c.....',
      'ggo...........'
    ]))
  ];

  return A;
})();
