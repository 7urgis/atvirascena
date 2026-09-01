# Atvira Scena

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

## How a Submission Is Published

1. A visitor fills out the form on the website, creating a GitHub issue.
2. `publish-video.yml` validates the link and checks that the visitor has not submitted 5 posts within the last 24 hours.
3. A valid submission is immediately saved to `content/videos/`; the workflow leaves a comment and closes the issue.
4. `deploy-atvirascena.yml` rebuilds and publishes the website.

No manual approval label is required. A single GitHub user can automatically publish up to 5 posts within a rolling 24-hour window. In the repository under **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.

To add an entry manually, duplicate an existing file in the `content/videos/` directory and update its metadata. It is convenient to use the 11-character YouTube ID as the filename.