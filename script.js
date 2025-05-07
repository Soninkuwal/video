        window.onload = function() {
            // Show the custom modal instead of the alert
            document.getElementById('customAlert').classList.add('show');
        }

        function closeModal() {
            // Close the modal to proceed
            document.getElementById('customAlert').classList.remove('show');
        }

        function goToBot() {
            // Redirect to Telegram group
            window.location.href = 'https://t.me/Careerwill13';
        }

        document.addEventListener("DOMContentLoaded", async () => {
            // Get the video source URL from a query parameter or another source
            // For example, let's assume the video URL is passed as a query parameter 'videoUrl'
            const urlParams = new URLSearchParams(window.location.search);
            const sourceUrl = urlParams.get('videoUrl'); // Get video URL from 'videoUrl' query parameter

            if (!sourceUrl) {
                alert("No video URL provided!");
                // Hide loading screen even if no video
                document.getElementById('loading').style.display = 'none';
                return;
            }

            let playerConfig = {
                width: "100%",
                height: "100%",
                autostart: false, // You can change this to true if you want it to play automatically
                playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2], // Define available playback speeds
                playbackRateSorting: "ascending", // Sort playback rates
                // Add other JW Player configurations as needed
                // For example, controlling the UI: controls: true
            };

            // Handle Classplus API and different video types
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
                        console.error("Failed to fetch DRM URLs:", data);
                        alert("Error fetching video source.");
                        document.getElementById('loading').style.display = 'none';
                        return;
                    }

                    if (data.drmUrls && data.drmUrls.manifestUrl && data.drmUrls.licenseUrl) {
                        // DASH with Widevine DRM
                        playerConfig.file = data.drmUrls.manifestUrl;
                        playerConfig.type = 'dash';
                        playerConfig.protection = {
                            "widevine": {
                                "url": data.drmUrls.licenseUrl
                            }
                        };
                    } else if (data.url) {
                        // Direct URL (assumed HLS based on original logic)
                         playerConfig.file = data.url;
                         // JW Player can usually auto-detect type, but being explicit is good
                         if (data.url.includes('.m3u8')) {
                             playerConfig.type = 'hls';
                         } else if (data.url.includes('.mpd')) {
                              playerConfig.type = 'dash';
                         } // Add other types if necessary
                    } else {
                         console.error("Invalid response from Classplus API:", data);
                         alert("Error processing video source.");
                         document.getElementById('loading').style.display = 'none';
                         return;
                    }

                } catch (error) {
                    console.error("Error fetching video details from Classplus API:", error);
                    alert("Error loading video.");
                    document.getElementById('loading').style.display = 'none';
                    return;
                }
            } else {
                // Handle other direct URLs (including existing .m3u8 not from Classplus API)
                playerConfig.file = sourceUrl;
                 if (sourceUrl.includes('.m3u8')) {
                    playerConfig.type = 'hls';
                } else if (sourceUrl.includes('.mpd')) {
                     playerConfig.type = 'dash';
                } // Add other types if necessary (e.g., 'mp4')
            }

            // Initialize JW Player
            const playerInstance = jwplayer("player").setup(playerConfig);

            // Hide loading screen when JW Player is ready
            playerInstance.on('ready', () => {
                document.getElementById('loading').style.display = 'none';
            });

            playerInstance.on('error', (event) => {
                 console.error("JW Player Error:", event);
                 alert("An error occurred during video playback.");
                 document.getElementById('loading').style.display = 'none';
            });


            // --- Double Click Skip Logic Adaptation for JW Player ---
            const skipOverlay = document.createElement("div");
            skipOverlay.id = "jw-time-skip";
            skipOverlay.style.position = "absolute";
            skipOverlay.style.top = "50%";
            skipOverlay.style.left = "50%";
            skipOverlay.style.transform = "translate(-50%, -50%)";
            skipOverlay.style.color = "#fff";
            skipOverlay.style.fontSize = "24px";
            skipOverlay.style.opacity = "0";
            skipOverlay.style.transition = "opacity 0.3s";
            skipOverlay.style.pointerEvents = "none"; // Allow clicks to pass through
             skipOverlay.style.zIndex = "10"; // Ensure it's above the player
            document.getElementById('player').appendChild(skipOverlay); // Append to the player container

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

            // Use a click listener on the player container or the video element within it
             // JW Player creates its own video element, so attach the listener to the container
            document.getElementById('player').addEventListener('click', function(e) {
                 // Check if the player is initialized and ready
                 if (!playerInstance || !playerInstance.getDuration()) {
                     return;
                 }

                const count = counter.clicked();
                if (count < 2) return;

                const rect = this.getBoundingClientRect(); // Use 'this' which is the player container
                const x = e.clientX - rect.left;
                const width = this.offsetWidth; // Use 'this' for container width
                const perc = (x * 100) / width;

                const panic = counter.last_side !== null;
                const last_click = counter.last_side;

                const currentTime = playerInstance.getPosition();
                const duration = playerInstance.getDuration();

                if (perc < 40) {
                    if (currentTime === 0) return;
                    counter.last_side = "L";
                    if (panic && last_click !== "L") {
                        counter.reset_count(1);
                        return;
                    }
                    skipOverlay.style.opacity = "0.9";
                    playerInstance.seek(currentTime - 10); // Use JW Player seek method
                    skipOverlay.innerText = "⫷⪡\n10s";
                } else if (perc > 60) {
                    if (currentTime === duration) return;
                    counter.last_side = "R";
                    if (panic && last_click !== "R") {
                        counter.reset_count(1);
                        return;
                    }
                    skipOverlay.style.opacity = "0.9";
                    playerInstance.seek(currentTime + 10); // Use JW Player seek method
                    skipOverlay.innerText = "⪢⫸\n10s";
                } else {
                    playerInstance.playToggle(); // Use JW Player playToggle method
                    counter.last_click = "C";
                }
            });
             // --- End Double Click Skip Logic Adaptation ---

        });