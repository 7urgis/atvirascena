# Atvira scena

Minimalus „Hugo“ tinklalapis, kuriame bendruomenė gali siūlyti viešus gyvų koncertų „YouTube“ įrašus.

## Paleidimas kompiuteryje

Reikalingas [Hugo](https://gohugo.io/installation/).

```sh
hugo server
```

Atidarykite `http://localhost:1313`.

Patikros:

```sh
hugo --minify
node --test
```


## Kaip paskelbiamas pasiūlymas

1. Lankytojas užpildo formą svetainėje ir sukuria „GitHub“ issue.
2. `publish-video.yml` patikrina nuorodą ir ar lankytojas per paskutines 24 valandas nepaskelbė 5 įrašų.
3. Tinkamas pasiūlymas iš karto įrašomas į `content/videos/`; veiksena pakomentuoja ir uždaro issue.
4. `deploy-atvirascena.yml` iš naujo sukuria ir paskelbia svetainę.

Papildomo patvirtinimo žyma nereikalinga. Vienas „GitHub“ naudotojas gali automatiškai paskelbti iki 5 įrašų per slenkantį 24 valandų laikotarpį. Repozitorijos **Settings → Pages → Build and deployment** skiltyje kaip šaltinį pasirinkite **GitHub Actions**.

Norėdami pridėti įrašą rankiniu būdu, nukopijuokite esamą failą `content/videos/` kataloge ir pakeiskite jo duomenis. Failo pavadinimui patogu naudoti 11 simbolių „YouTube“ ID.
