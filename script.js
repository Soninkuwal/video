document.addEventListener("DOMContentLoaded", async () => {
    const video = document.querySelector("video");
    const videoSource = document.getElementById("videoSource");

    if (!videoSource.src) {
        alert("No video URL provided!");
        return;
    }

    const sourceUrl = videoSource.src;

    if (sourceUrl.includes(".mpd") || sourceUrl.includes("media-cdn.classplusapp.com")) {
        try {
            const headers = {
                'x-access-token': 'eyJjb3Vyc2VJZCI6IjUyNzU4MSIsInR1dG9ySWQiOm51bGwsIm9yZ0lkIjo4OTQxLCJjYXRlZ29yeUlkIjpudWxsfQ=='
            };
            const response = await fetch(`https://api.classplusapp.com/cams/uploader/video/jw-signed-url?url=${encodeURIComponent(sourceUrl)}`, {
                method: 'GET',
                headers: headers
            });
            const data = await response.json();

            if (data.status !== 'ok') {
                console.error("Failed to fetch DRM URLs");
                return;
            }

            // Integrate your snippet here
            let mpdUrl, licenseUrl, hlsUrl;
            if (!('drmUrls' in data)) {
                hlsUrl = data.url; // Assume this is an HLS URL if drmUrls is absent
            } else {
                mpdUrl = data.drmUrls.manifestUrl;
                licenseUrl = data.drmUrls.licenseUrl;
            }

            if (mpdUrl && licenseUrl) {
                // DASH playback with DRM
                const dash = dashjs.MediaPlayer().create();
                dash.initialize(video, mpdUrl, false);
                dash.setProtectionData({
                    "com.widevine.alpha": {
                        "serverURL": licenseUrl,
                        'priority': 1
                    }
                });
                // Rest of DASH logic (Plyr setup, skip functionality) remains the same
                dash.on("streamInitialized", function() {
                    const availableQualities = dash.getBitrateInfoListFor("video").map((l) => l.height);
                    const player = new Plyr(video, {
                        quality: {
                            default: availableQualities[0],
                            options: availableQualities,
                            forced: true,
                            onChange: (newQuality) => {
                                dash.getBitrateInfoListFor("video").forEach((level, levelIndex) => {
                                    if (level.height === newQuality) {
                                        dash.setQualityFor("video", level.qualityIndex);
                                    }
                                });
                            },
                        },
                    });
                    // Skip overlay and click logic (unchanged)
                    setupSkipOverlayAndClicks(player, video);
                });
            } else if (hlsUrl && Hls.isSupported()) {
                // HLS playback
                const hls = new Hls({ maxMaxBufferLength: 100 });
                hls.loadSource(hlsUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    const player = new Plyr(video, {
                        quality: {
                            default: 720,
                            options: [360, 480, 720, 1080],
                            forced: true,
                            onChange: (quality) => {
                                hls.levels.forEach((level, index) => {
                                    if (level.height === quality) {
                                        hls.currentLevel = index;
                                    }
                                });
                            },
                        },
                    });
                    // Skip overlay and click logic
                    setupSkipOverlayAndClicks(player, video);
                });
                window.hls = hls;
            }
        } catch (error) {
            console.error("Error playing video:", error);
        }
    } else if (Hls.isSupported() && sourceUrl.includes(".m3u8")) {
        // Existing HLS logic remains unchanged
        const hls = new Hls({ maxMaxBufferLength: 100 });
        hls.loadSource(sourceUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const player = new Plyr(video, {
                quality: {
                    default: 720,
                    options: [360, 480, 720, 1080],
                    forced: true,
                    onChange: (quality) => {
                        hls.levels.forEach((level, index) => {
                            if (level.height === quality) {
                                hls.currentLevel = index;
                            }
                        });
                    },
                },
            });
            setupSkipOverlayAndClicks(player, video);
        });
        window.hls = hls;
    } else {
        const player = new Plyr(video);
    }

    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 5000);
});

// Helper function to avoid code duplication for skip overlay and click logic
function setupSkipOverlayAndClicks(player, video) {
    const skipOverlay = document.createElement("div");
    skipOverlay.id = "plyr__time_skip";
    skipOverlay.style.position = "absolute";
    skipOverlay.style.top = "50%";
    skipOverlay.style.left = "50%";
    skipOverlay.style.transform = "translate(-50%, -50%)";
    skipOverlay.style.color = "#fff";
    skipOverlay.style.fontSize = "24px";
    skipOverlay.style.opacity = "0";
    skipOverlay.style.transition = "opacity 0.3s";
    document.querySelector(".plyr").appendChild(skipOverlay);

    class MultiClickCounter {
        constructor() {
            this.timers = [];
            this.count = 0;
            this.reseted = 0;
            this.last_side = null;
        }

        clicked() {
            this.count += 1;
            const xcount = this.count;
            this.timers.push(setTimeout(() => this.reset(xcount), 500));
            return this.count;
        }

        reset_count(n) {
            this.reseted = this.count;
            this.count = n;
            this.timers.forEach(timer => clearTimeout(timer));
            this.timers = [];
        }

        reset(xcount) {
            if (this.count > xcount) return;
            this.count = 0;
            this.last_side = null;
            this.reseted = 0;
            skipOverlay.style.opacity = "0";
            this.timers = [];
        }
    }

    const counter = new MultiClickCounter();

    video.onclick = function (e) {
        const count = counter.clicked();
        if (count < 2) return;

        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = e.target.offsetWidth;
        const perc = (x * 100) / width;

        const panic = counter.last_side !== null;
        const last_click = counter.last_side;

        if (perc < 40) {
            if (player.currentTime === 0) return;
            counter.last_side = "L";
            if (panic && last_click !== "L") {
                counter.reset_count(1);
                return;
            }
            skipOverlay.style.opacity = "0.9";
            player.rewind(10);
            skipOverlay.innerText = "⫷⪡\n10s";
        } else if (perc > 60) {
            if (player.currentTime === player.duration) return;
            counter.last_side = "R";
            if (panic && last_click !== "R") {
                counter.reset_count(1);
                return;
            }
            skipOverlay.style.opacity = "0.9";
            player.forward(10);
            skipOverlay.innerText = "⪢⫸\n10s";
        } else {
            player.togglePlay();
            counter.last_click = "C";
        }
    };
                }
