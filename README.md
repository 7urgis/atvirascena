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
2. Prižiūrėtojas patikrina nuorodą ir prideda issue žymą `approved`.
3. `publish-video.yml` sukuria failą `content/videos/`, įkelia pakeitimą į `main`, pakomentuoja ir uždaro issue.
4. `deploy-atvirascena.yml` iš naujo sukuria ir paskelbia svetainę.

Prieš pirmą pasiūlymą repozitorijos **Issues → Labels** skiltyje sukurkite žymą `approved`. Repozitorijos **Settings → Pages → Build and deployment** skiltyje kaip šaltinį pasirinkite **GitHub Actions**.

Norėdami pridėti įrašą rankiniu būdu, nukopijuokite esamą failą `content/videos/` kataloge ir pakeiskite jo duomenis. Failo pavadinimui patogu naudoti 11 simbolių „YouTube“ ID.

