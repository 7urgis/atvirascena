# AtviraScena

[**Watch on AtviraScena →**](https://7urgis.github.io/atvirascena/)

A minimal Hugo website where the community can submit public YouTube recordings of live concerts.

## Running Locally

Requires [Hugo](https://gohugo.io/installation/).

```sh
hugo server
```

Open `http://localhost:1313`.

Checks:

```sh
hugo --minify
node --test
```

## Live channel

The **Live** navigation link opens `/live/`. Every browser uses the same UTC
epoch and repeating playlist in `data/live.json` to select a concert and playback
position. No backend or API key is needed. Playback starts muted when allowed;
visitors can click to join with sound. The player checks the schedule every second,
corrects drift over three seconds, and rejoins the current position after a pause.

New submissions automatically join the Live playlist when published. The existing
GitHub Actions publishing workflow reads each recording's duration from YouTube
and saves both the concert and playlist in the same commit. No backend or API key
is needed. If YouTube does not return a valid duration, the issue remains open
with a retry message; editing the issue retries publishing.

Open Live pages check the static playlist every minute and when returning to the
tab. A playlist update recalculates the shared position and may switch the current
concert. Viewers converge on the updated schedule within the polling interval
once deployment and CDN updates reach them. For manual additions, also add the
video ID, title and duration in seconds to `data/live.json`. Keep the epoch fixed.
Device clocks, buffering, and YouTube ads can affect synchronization. An unavailable
video keeps its scheduled slot so individual playback errors do not split viewers
onto different concerts.

## How a Submission Is Published

1. A visitor fills out the form on the website, creating a GitHub issue.
2. `publish-video.yml` validates the link and checks that the visitor has not submitted 5 posts within the last 24 hours.
3. A valid submission is immediately saved to `content/videos/`; the workflow leaves a comment and closes the issue.
4. `deploy-atvirascena.yml` rebuilds and publishes the website.

No manual approval label is required. A single GitHub user can automatically publish up to 5 posts within a rolling 24-hour window. In the repository under **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.

To add an entry manually, duplicate an existing file in the `content/videos/` directory and update its metadata. It is convenient to use the 11-character YouTube ID as the filename.
