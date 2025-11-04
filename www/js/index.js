let zleceniaData = null;

document.addEventListener('deviceready', function() {
    console.log('Cordova gotowa');
    
    // Sprawdź połączenie i załaduj dane
    sprawdzPolaczenie();
    
    // Nasłuchuj zmian statusu połączenia
    document.addEventListener('online', onOnline, false);
    document.addEventListener('offline', onOffline, false);
}, false);

function sprawdzPolaczenie() {
    const networkState = navigator.connection.type;
    
    if (networkState !== Connection.NONE && networkState !== Connection.UNKNOWN) {
        // Jest internet - pobierz najnowsze dane
        zaladujDaneZSerwera();
    } else {
        // Brak internetu - użyj cache
        zaladujDaneZCache();
    }
}

function zaladujDaneZSerwera() {
    fetch('zlecenia.json')
        .then(response => response.json())
        .then(data => {
            // Zapisz dane w localStorage
            localStorage.setItem('zleceniaData', JSON.stringify(data));
            localStorage.setItem('lastUpdate', new Date().toISOString());
            
            zleceniaData = data;
            cachujPlikiBinarne(data);
            wyswietlListeZlecen();
            
            ons.notification.toast('Dane zaktualizowane', {
                timeout: 2000,
                animation: 'fall'
            });
        })
        .catch(error => {
            console.error('Błąd pobierania danych:', error);
            zaladujDaneZCache();
        });
}

function zaladujDaneZCache() {
    const cachedData = localStorage.getItem('zleceniaData');
    
    if (cachedData) {
        zleceniaData = JSON.parse(cachedData);
        wyswietlListeZlecen();
        
        const lastUpdate = localStorage.getItem('lastUpdate');
        if (lastUpdate) {
            ons.notification.toast('Dane offline z: ' + new Date(lastUpdate).toLocaleString(), {
                timeout: 3000
            });
        }
    } else {
        ons.notification.alert('Brak danych w cache. Wymagane połączenie internetowe.');
    }
}

function cachujPlikiBinarne(data) {
    // Dla każdego zlecenia pobierz i cachuj plik binarny
    data.zlecenia.forEach(zlecenie => {
        if (zlecenie.obraz_dokumentu) {
            cachujObraz(zlecenie.obraz_dokumentu);
        }
    });
}

function cachujObraz(sciezka) {
    fetch(sciezka)
        .then(response => response.blob())
        .then(blob => {
            const reader = new FileReader();
            reader.onloadend = function() {
                // Zapisz jako base64 w localStorage
                localStorage.setItem('cached_' + sciezka, reader.result);
            };
            reader.readAsDataURL(blob);
        })
        .catch(error => console.error('Błąd cachowania obrazu:', error));
}

function pobierzObraz(sciezka) {
    // Sprawdź czy obraz jest w cache
    const cached = localStorage.getItem('cached_' + sciezka);
    return cached || sciezka;
}

function wyswietlListeZlecen() {
    if (!zleceniaData) return;
    
    const lista = document.getElementById('zlecenia-lista');
    lista.innerHTML = '';
    
    zleceniaData.zlecenia.forEach((zlecenie, index) => {
        const item = `
            <ons-list-item tappable onclick="pokazSzczegoly(${index})">
                <div class="center">
                    <span class="list-item__title">${zlecenie.numer_zlecenia}</span>
                    \n
                    <span class="list-item__subtitle">${zlecenie.klient} - ${zlecenie.trasa}</span>
                </div>
                <div class="right">
                    <ons-icon icon="md-chevron-right"></ons-icon>
                </div>
            </ons-list-item>
        `;
        lista.insertAdjacentHTML('beforeend', item);
    });
}

function pokazSzczegoly(index) {
    const zlecenie = zleceniaData.zlecenia[index];
    
    const navigator = document.getElementById('myNavigator');
    navigator.pushPage('szczegoly.html').then(() => {
        const content = document.getElementById('szczegoly-content');
        const obrazUrl = pobierzObraz(zlecenie.obraz_dokumentu);
        
        content.innerHTML = `
            <ons-card>
                <div class="title">${zlecenie.numer_zlecenia}</div>
                <div class="content">
                    <p><strong>Klient:</strong> ${zlecenie.klient}</p>
                    <p><strong>Trasa:</strong> ${zlecenie.trasa}</p>
                    <p><strong>Data załadunku:</strong> ${zlecenie.data_zaladunku}</p>
                    <p><strong>Data rozładunku:</strong> ${zlecenie.data_rozladunku}</p>
                    <p><strong>Status:</strong> ${zlecenie.status}</p>
                    <p><strong>Wartość:</strong> ${zlecenie.wartosc}</p>
                    <p><strong>Masa:</strong> ${zlecenie.masa}</p>
                    <p><strong>Uwagi:</strong> ${zlecenie.uwagi}</p>
                    <img src="${obrazUrl}" style="width:100%; margin-top:10px;">
                </div>
            </ons-card>
            
            <ons-list-header>Punkty przeładunkowe</ons-list-header>
            <ons-list id="punkty-lista"></ons-list>
            
            <ons-button modifier="large" onclick="pokazDanePojazdu(${index})">
                Dane pojazdu
            </ons-button>
        `;
        
        const punktyLista = document.getElementById('punkty-lista');
        zlecenie.punkty_przeladunkowe.forEach((punkt, pIndex) => {
            const item = `
                <ons-list-item tappable onclick="pokazPunkt(${index}, ${pIndex})">
                    <div class="center">
                        <span class="list-item__title">${punkt.nazwa}</span>
                        <span class="list-item__subtitle">${punkt.adres}</span>
                    </div>
                </ons-list-item>
            `;
            punktyLista.insertAdjacentHTML('beforeend', item);
        });
    });
}

function pokazPunkt(zlecenieIndex, punktIndex) {
    const punkt = zleceniaData.zlecenia[zlecenieIndex].punkty_przeladunkowe[punktIndex];
    
    const navigator = document.getElementById('myNavigator');
    navigator.pushPage('zagniezdzone.html').then(() => {
        document.getElementById('zagniezdzone-tytul').textContent = punkt.nazwa;
        document.getElementById('zagniezdzone-content').innerHTML = `
            <ons-card>
                <div class="title">Informacje kontaktowe</div>
                <div class="content">
                    <p><strong>Nazwa:</strong> ${punkt.nazwa}</p>
                    <p><strong>Adres:</strong> ${punkt.adres}</p>
                    <p><strong>Kontakt:</strong> ${punkt.kontakt}</p>
                </div>
            </ons-card>
        `;
    });
}

function pokazDanePojazdu(index) {
    const pojazd = zleceniaData.zlecenia[index].dane_pojazdu;
    
    const navigator = document.getElementById('myNavigator');
    navigator.pushPage('zagniezdzone.html').then(() => {
        document.getElementById('zagniezdzone-tytul').textContent = 'Dane pojazdu';
        document.getElementById('zagniezdzone-content').innerHTML = `
            <ons-card>
                <div class="title">Informacje o pojeździe</div>
                <div class="content">
                    <p><strong>Marka ciągnika:</strong> ${pojazd.marka}</p>
                    <p><strong>Nr rejestracyjny:</strong> ${pojazd.numer_rejestracyjny}</p>
                    <p><strong>Kierowca:</strong> ${pojazd.kierowca}</p>
                    <p><strong>Telefon:</strong> ${pojazd.telefon}</p>
                </div>
            </ons-card>
        `;
    });
}

function onOnline() {
    console.log('Połączenie internetowe dostępne');
    sprawdzPolaczenie();
}

function onOffline() {
    console.log('Brak połączenia internetowego');
    ons.notification.toast('Tryb offline', { timeout: 2000 });
}
