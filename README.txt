Trace Racing v18

Alap: a v16-ban stabilan működő, pontosan rajzolt útvonalat követő autó.

v18 fizika:
- normál sebességnél az autó szorosan követi a játékos által rajzolt vonalat;
- a kanyart a sebesség² × görbület alapján terheli;
- ha a szükséges oldalirányú tapadás meghaladja a rendelkezésre álló gripet, fokozatos külső irányú kisodródás indul;
- a kisodródásnak van oldalirányú tehetetlensége és csillapítása;
- a csúszás sebességet veszít, ezért időveszteséget okoz;
- amikor a sebesség visszaesik, a tapadás visszatér, és az autó fokozatosan visszahúzódik a pontosan megrajzolt versenyvonalra;
- a drift maximális mértéke korlátozott, hogy a stabil vonalkövetés ne romoljon el;
- a v17 hibás, fix offset jellegű viselkedését nem használja.

PWA frissítés:
- v18 cache;
- app fájlok network-first;
- Service Worker automatikus frissítés és controllerchange reload.

Telepítés/frissítés:
1. A ZIP tartalmát töltsd fel a GitHub repó gyökerébe.
2. Az azonos nevű fájlokat írd felül.
3. Várd meg, amíg a GitHub Pages publikálja az új commitot.
4. Nyisd meg az appot; az új Service Worker automatikusan ellenőrzi a v18-at.
