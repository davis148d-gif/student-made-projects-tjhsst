
        window.onload = () => {
            const startBtn = document.getElementById("start");
            const progress = document.getElementById("progress");
            const road = document.getElementById("road");
            const roadContainer = document.getElementById("roadContainer");
            const car = document.getElementById("car");
            const leftArrow = document.getElementById("leftArrow");
            const rightArrow = document.getElementById("rightArrow");
            const energyConsumedCount = document.getElementById("energyConsumed");
            const energyMissedCount = document.getElementById("energyMissed");


            const roadHeight = 580;
            const roadEnergyHeight = 24;
            const MIN_ACCELERATION = 1;
            const MAX_ACCELERATION = 5;
            const ACCELERATE_AFTER_EVERY = 3;

            let carTopPos = road.offsetHeight * .6;
            let acceleration = 1;
            let energyConsumed = 0;
            let energyMissed = 0;
            let gameOver = false;


            car.style.left = carSide(false) + 'px';

            window.onresize = function (event) {
                car.style.left = carSide(car.classList.contains("left")) + 'px';
                carTopPos = road.offsetHeight * .6;
            };

            initRoad();

            startBtn.addEventListener("click", () => {
                startBtn.style.display = 'none';

                startGame();
                updateProgress();

                initListeners();
            });

            function initListeners() {
                leftArrow.addEventListener("click", (e) => {
                    car.classList.add('left');
                    car.style.left = carSide(true) + 'px';
                });
                rightArrow.addEventListener("click", (e) => {
                    car.classList.remove('left');
                    car.style.left = carSide(false) + 'px';
                });
                document.onkeydown = (e) => {
                    if (e.keyCode == '37') {
                        car.classList.add('left');
                        car.style.left = carSide(true) + 'px';
                    }
                    else if (e.keyCode == '39') {
                        car.classList.remove('left');
                        car.style.left = carSide(false) + 'px';
                    }
                }
            }
            function initRoad() {
                addRoadWithEnergy(-roadHeight);
                addRoadWithEnergy(0);
                addRoadWithEnergy(roadHeight);
            }
            function addRoadWithEnergy(top) {
                const roadbg = document.createElement('div');
                roadbg.classList.add('road');
                roadbg.style.top = top + 'px';
                road.appendChild(roadbg);

                let energyTop = randomInt(roadEnergyHeight, roadHeight - roadEnergyHeight);
                let energyLeft = randomInt(1, 4) > 2;
                const roadEnergy = document.createElement('div');
                roadEnergy.classList.add('road-energy');
                roadEnergy.style.top = energyTop + 'px';
                if (energyLeft) roadEnergy.classList.add('left');
                roadbg.appendChild(roadEnergy);
            }
            function startGame() {
                setInterval(ticker, 5);
            }
            function ticker() {
                let roads = road.getElementsByClassName('road');
                for (let i = 0; i < roads.length; i++) {
                    let currentTop = parseFloat(roads[i].offsetTop);
                    let roadEnergy = roads[i].getElementsByClassName('road-energy')[0];

                    if (currentTop > roadHeight * 2) {
                        roads[i].style.top = (-roadHeight) + 'px';

                        let energyLeft = randomInt(1, 4) > 2;
                        if (energyLeft) roadEnergy.classList.add('left');
                        else roadEnergy.classList.remove('left');

                        roadEnergy.style.top = randomInt(roadEnergyHeight, roadHeight - roadEnergyHeight) + 'px';
                        roadEnergy.classList.remove('consumed');
                        roadEnergy.classList.remove('missed');
                    }
                    else {
                        roads[i].style.top = (currentTop + acceleration) + 'px';

                        let energyTop = currentTop + roadEnergy.offsetTop + acceleration;
                        if (carTopPos > energyTop &&
                            carTopPos < energyTop + roadEnergyHeight &&
                            !roadEnergy.classList.contains('consumed') && !roadEnergy.classList.contains('missed')) {
                            if (car.classList.contains('left') && roadEnergy.classList.contains('left') ||
                                !car.classList.contains('left') && !roadEnergy.classList.contains('left')) {
                                roadEnergy.classList.add('consumed');
                                energyConsumed++;
                            }
                            else {
                                roadEnergy.classList.add('missed');
                                energyMissed++;
                            }
                            updateProgress();
                        }

                    }
                }
            }
            function carSide(left) {
                return roadContainer.offsetLeft + road.offsetWidth * .1 + (road.offsetWidth * .8 / 2 * (left ? 1 : 3) - car.offsetWidth) / 2;
            }
            function updateProgress() {
                energyConsumedCount.innerHTML = energyConsumed;
                energyMissedCount.innerHTML = energyMissed;

                // acceleration
                acceleration = Math.min(Math.max(MIN_ACCELERATION, parseInt((energyConsumed - energyMissed) / ACCELERATE_AFTER_EVERY)), MAX_ACCELERATION);
            }


            function randomInt(min, max) {
                return Math.floor(Math.random() * (max - min)) + min;
            }
        }

    
