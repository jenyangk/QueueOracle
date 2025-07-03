class MessageMonitorApp {
    constructor() {
        this.ws = null;
        this.messages = [];
        this.selectedMessage = null;
        this.currentPage = 0;
        this.messagesPerPage = 100;
        this.isAutoScroll = true;

        // Gateway table state
        this.gatewayData = [];
        this.gatewaySortField = 'count';
        this.gatewaySortDirection = 'desc';

        this.initWebSocket();
        this.initEventListeners();
        this.updateConnectionStatus('CONNECTING...');
    }

    decodeGatewayId(base64GatewayId) {
        try {
            // Decode base64 to bytes
            const bytes = atob(base64GatewayId);

            // Convert to hex string
            let hex = "";
            for (let i = 0; i < bytes.length; i++) {
                hex += bytes.charCodeAt(i).toString(16).padStart(2, '0');
            }

            return hex.toUpperCase();
        } catch (error) {
            console.warn('Failed to decode gateway ID:', base64GatewayId, error);
            return base64GatewayId; // Return original if decoding fails
        }
    }

    decodePhyPayload(phyPayloadBase64) {
        try {
            // Convert from base64 to bytes
            const phyPayloadBytes = atob(phyPayloadBase64);

            // Convert to hex for easier analysis
            let phyPayloadHex = "";
            for (let i = 0; i < phyPayloadBytes.length; i++) {
                const byte = phyPayloadBytes.charCodeAt(i);
                phyPayloadHex += byte.toString(16).padStart(2, '0');
            }

            // Parse LoRaWAN frame structure
            // First byte is MHDR (MAC Header)
            const mhdr = phyPayloadBytes.charCodeAt(0);

            // Extract MType (bits 5-7)
            const mtype = (mhdr >> 5) & 0x07;
            const mtypeNames = {
                0: "Join Request",
                1: "Join Accept",
                2: "Unconfirmed Data Up",
                3: "Unconfirmed Data Down",
                4: "Confirmed Data Up",
                5: "Confirmed Data Down",
                6: "RFU",
                7: "Proprietary"
            };

            // Extract Major version (bits 0-1)
            const major = mhdr & 0x03;

            // Create basic frame structure
            const parsedFrame = {
                phyPayload: phyPayloadBase64,
                phyPayloadHex: phyPayloadHex.toUpperCase(),
                length: phyPayloadBytes.length,
                mhdr: {
                    mtype: mtype,
                    mtypeName: mtypeNames[mtype],
                    major: major
                }
            };

            // If this is a data frame (MType 2-5), parse the MAC payload
            if (mtype >= 2 && mtype <= 5) {
                // DevAddr (4 bytes, little endian)
                const devAddr = [];
                for (let i = 4; i >= 1; i--) {
                    devAddr.push(phyPayloadBytes.charCodeAt(i).toString(16).padStart(2, '0'));
                }

                // FCtrl (Frame Control) - byte 5
                const fctrl = phyPayloadBytes.charCodeAt(5);
                const foptslen = fctrl & 0x0F;

                // FCnt (Frame Counter) - bytes 6-7, little endian
                const fcnt = phyPayloadBytes.charCodeAt(6) + (phyPayloadBytes.charCodeAt(7) << 8);

                // FPort (if present) - next byte after FOpts
                const foptsEnd = 8 + foptslen;
                let fport = null;
                let frmPayload = "";

                if (foptsEnd < phyPayloadBytes.length - 4) { // -4 for MIC
                    fport = phyPayloadBytes.charCodeAt(foptsEnd);
                    const frmPayloadStart = foptsEnd + 1;
                    const frmPayloadEnd = phyPayloadBytes.length - 4;

                    for (let i = frmPayloadStart; i < frmPayloadEnd; i++) {
                        frmPayload += phyPayloadBytes.charCodeAt(i).toString(16).padStart(2, '0');
                    }
                }

                // MIC (Message Integrity Code) - last 4 bytes
                let mic = "";
                for (let i = phyPayloadBytes.length - 4; i < phyPayloadBytes.length; i++) {
                    mic += phyPayloadBytes.charCodeAt(i).toString(16).padStart(2, '0');
                }

                parsedFrame.macPayload = {
                    fhdr: {
                        devAddr: devAddr.join('').toUpperCase(),
                        fctrl: {
                            adr: (fctrl >> 7) & 0x01,
                            adrackreq: (fctrl >> 6) & 0x01,
                            ack: (fctrl >> 5) & 0x01,
                            fpending: (fctrl >> 4) & 0x01,
                            foptslen: foptslen
                        },
                        fcnt: fcnt
                    },
                    fport: fport,
                    frmPayload: frmPayload.toUpperCase(),
                    mic: mic.toUpperCase()
                };
            }

            return parsedFrame;
        } catch (error) {
            console.warn('Failed to decode phyPayload:', phyPayloadBase64, error);
            return {
                phyPayload: phyPayloadBase64,
                error: error.message
            };
        }
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus('CONNECTED', true);
            // Request to start message monitoring
            this.ws.send(JSON.stringify({ action: 'startMessageMonitoring' }));
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // Handle batched messages
            if (data.type === 'batch' && data.messages) {
                data.messages.forEach(message => this.handleMessage(message));
            } else {
                this.handleMessage(data);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus('DISCONNECTED', false);
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.initWebSocket(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('ERROR', false);
        };
    }

    initEventListeners() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.requestRefresh();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearMessages();
        });

        // Add memory cleanup button
        this.addMemoryControls();

        // Add pagination controls
        this.addPaginationControls();
    }

    addPaginationControls() {
        const controlsHtml = `
            <div id="paginationControls" style="margin: 10px 0; display: flex; align-items: center; gap: 10px;">
                <button id="prevPageBtn" style="padding: 5px 10px; background: #333; color: white; border: 1px solid #555; cursor: pointer;">Previous</button>
                <span id="pageInfo" style="color: #ccc;">Page 1 of 1</span>
                <button id="nextPageBtn" style="padding: 5px 10px; background: #333; color: white; border: 1px solid #555; cursor: pointer;">Next</button>
                <span style="color: #ccc; margin-left: 20px;">Per page:</span>
                <select id="pageSizeSelect" style="padding: 5px; background: #333; color: white; border: 1px solid #555;">
                    <option value="50">50</option>
                    <option value="100" selected>100</option>
                    <option value="200">200</option>
                    <option value="500">500</option>
                </select>
                <label style="color: #ccc; margin-left: 20px;">
                    <input type="checkbox" id="autoScrollCheck" checked> Auto-scroll to newest
                </label>
            </div>
        `;

        const messageCountEl = document.getElementById('messageCount');
        messageCountEl.parentNode.insertAdjacentHTML('afterend', controlsHtml);

        // Add event listeners for pagination
        document.getElementById('prevPageBtn').addEventListener('click', () => {
            if (this.currentPage > 0) {
                this.currentPage--;
                this.updateMessages(this.messages);
            }
        });

        document.getElementById('nextPageBtn').addEventListener('click', () => {
            const totalPages = Math.ceil(this.messages.length / this.messagesPerPage);
            if (this.currentPage < totalPages - 1) {
                this.currentPage++;
                this.updateMessages(this.messages);
            }
        });

        document.getElementById('pageSizeSelect').addEventListener('change', (e) => {
            this.messagesPerPage = parseInt(e.target.value);
            this.currentPage = 0;
            this.updateMessages(this.messages);
        });

        document.getElementById('autoScrollCheck').addEventListener('change', (e) => {
            this.isAutoScroll = e.target.checked;
        });
    }

    addMemoryControls() {
        const controlsHtml = `
            <div id="memoryControls" style="margin: 10px 0; display: flex; align-items: center; gap: 10px;">
                <button class="btn danger" id="memoryCleanupBtn" style="padding: 5px 10px; background: #666; color: white; border: 1px solid #888; cursor: pointer;">Force Memory Cleanup</button>
                <span id="memoryStatus" style="color: #ccc; font-size: 12px;">Memory: 0 MB</span>
            </div>
        `;

        const clearBtn = document.getElementById('clearBtn');
        clearBtn.parentNode.insertAdjacentHTML('afterend', controlsHtml);

        document.getElementById('memoryCleanupBtn').addEventListener('click', () => {
            this.forceMemoryCleanup();
        });
    }

    handleMessage(data) {
        switch (data.type) {
            case 'messagesUpdate':
                this.updateMessages(data.messages);
                this.updateStatistics(data.statistics);
                break;
            case 'messageError':
                this.showError(data.error);
                break;
            case 'memoryCleanupComplete':
                this.showMemoryCleanupResult(data.cleanup);
                break;
            case 'memoryStats':
                this.updateMemoryDisplay(data.memoryStats);
                break;
        }
    }

    updateConnectionStatus(status, connected = false) {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.textContent = status;
        statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }

    updateMessages(messages) {
        this.messages = messages;
        const tbody = document.getElementById('messageTableBody');
        const countEl = document.getElementById('messageCount');

        countEl.textContent = messages.length;
        tbody.innerHTML = '';

        // Sort by sequence number (newest first)
        const sortedMessages = [...messages].sort((a, b) =>
            parseInt(b.sequenceNumber) - parseInt(a.sequenceNumber)
        );

        // Auto-scroll to newest messages if enabled
        if (this.isAutoScroll && sortedMessages.length > 0) {
            this.currentPage = 0;
        }

        // Calculate pagination
        const totalPages = Math.ceil(sortedMessages.length / this.messagesPerPage);
        const startIndex = this.currentPage * this.messagesPerPage;
        const endIndex = startIndex + this.messagesPerPage;
        const paginatedMessages = sortedMessages.slice(startIndex, endIndex);

        // Update pagination controls
        this.updatePaginationControls(totalPages, sortedMessages.length);

        // Render paginated messages
        paginatedMessages.forEach((message, index) => {
            const row = document.createElement('tr');
            row.dataset.messageIndex = startIndex + index;

            const messageClass = message.isChirpStack ? 'message-chirpstack' : 'message-other';
            const typeClass = this.getTypeClass(message.messageType);

            const gatewayInfo = message.gatewayInfo ?
                (message.gatewayInfo.gatewayId || 'Unknown') : '-';
            const deviceInfo = message.deviceInfo ?
                (message.deviceInfo.devEui || 'Unknown') : '-';

            const enqueuedTime = new Date(message.enqueuedTimeUtc).toLocaleString();

            row.innerHTML = `
                <td class="${messageClass}">${message.sequenceNumber}</td>
                <td class="${typeClass}">${message.messageType}</td>
                <td class="${messageClass}">${gatewayInfo}</td>
                <td class="${messageClass}">${deviceInfo}</td>
                <td style="color: #888">${enqueuedTime}</td>
                <td style="color: #ffff00">${message.size}B</td>
                <td class="preview-text" style="color: #888" title="${message.preview}">${message.preview}</td>
            `;

            row.addEventListener('click', () => {
                this.selectMessage(message);
                // Highlight selected row
                document.querySelectorAll('.message-table tr').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
            });

            tbody.appendChild(row);
        });
    }

    updatePaginationControls(totalPages, totalMessages) {
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage + 1} of ${totalPages || 1} (${totalMessages} total)`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 0;
            prevBtn.style.opacity = this.currentPage === 0 ? '0.5' : '1';
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages - 1;
            nextBtn.style.opacity = this.currentPage >= totalPages - 1 ? '0.5' : '1';
        }
    }

    getTypeClass(messageType) {
        switch (messageType.toLowerCase()) {
            case 'uplink':
                return 'message-type-uplink';
            case 'downlink':
                return 'message-type-downlink';
            case 'device event':
            case 'gateway event':
                return 'message-type-event';
            default:
                return 'message-other';
        }
    }

    selectMessage(message) {
        this.selectedMessage = message;
        const detailsEl = document.getElementById('messageDetails');

        const formattedJson = this.formatJson(message.body);

        // Try to decode phyPayload if available
        let phyPayloadDecoded = null;
        if (message.body && message.body.phyPayload) {
            phyPayloadDecoded = this.decodePhyPayload(message.body.phyPayload);
        }

        let phyPayloadSection = '';
        if (phyPayloadDecoded) {
            if (phyPayloadDecoded.error) {
                phyPayloadSection = `
<span class="json-key">PhyPayload Decode Error:</span> <span style="color: #ff6666;">${phyPayloadDecoded.error}</span>
`;
            } else {
                phyPayloadSection = `
<span class="json-key">Decoded PhyPayload:</span>
<span class="json-key">  Hex:</span> <span class="json-string">${phyPayloadDecoded.phyPayloadHex}</span>
<span class="json-key">  Length:</span> <span class="json-number">${phyPayloadDecoded.length} bytes</span>
<span class="json-key">  Message Type:</span> <span class="json-string">${phyPayloadDecoded.mhdr.mtypeName} (${phyPayloadDecoded.mhdr.mtype})</span>
<span class="json-key">  LoRaWAN Version:</span> <span class="json-number">${phyPayloadDecoded.mhdr.major}</span>`;

                if (phyPayloadDecoded.macPayload) {
                    phyPayloadSection += `
<span class="json-key">  Device Address:</span> <span class="json-string">${phyPayloadDecoded.macPayload.fhdr.devAddr}</span>
<span class="json-key">  Frame Counter:</span> <span class="json-number">${phyPayloadDecoded.macPayload.fhdr.fcnt}</span>
<span class="json-key">  Frame Control:</span>
<span class="json-key">    ADR:</span> <span class="json-boolean">${phyPayloadDecoded.macPayload.fhdr.fctrl.adr}</span>
<span class="json-key">    ACK:</span> <span class="json-boolean">${phyPayloadDecoded.macPayload.fhdr.fctrl.ack}</span>
<span class="json-key">    Frame Pending:</span> <span class="json-boolean">${phyPayloadDecoded.macPayload.fhdr.fctrl.fpending}</span>`;

                    if (phyPayloadDecoded.macPayload.fport !== null) {
                        phyPayloadSection += `
<span class="json-key">  Frame Port:</span> <span class="json-number">${phyPayloadDecoded.macPayload.fport}</span>`;
                    }

                    if (phyPayloadDecoded.macPayload.frmPayload) {
                        phyPayloadSection += `
<span class="json-key">  Frame Payload (encrypted):</span> <span class="json-string">${phyPayloadDecoded.macPayload.frmPayload}</span>`;
                    }

                    phyPayloadSection += `
<span class="json-key">  MIC:</span> <span class="json-string">${phyPayloadDecoded.macPayload.mic}</span>`;
                }

                phyPayloadSection += `
`;
            }
        }

        detailsEl.innerHTML = `
<span class="json-key">Message ID:</span> <span class="json-string">${message.messageId || 'N/A'}</span>
<span class="json-key">Sequence Number:</span> <span class="json-number">${message.sequenceNumber}</span>
<span class="json-key">Enqueued Time:</span> <span class="json-string">${new Date(message.enqueuedTimeUtc).toLocaleString()}</span>
<span class="json-key">Delivery Count:</span> <span class="json-number">${message.deliveryCount}</span>
<span class="json-key">Message Type:</span> <span class="json-string">${message.messageType}</span>
<span class="json-key">Size:</span> <span class="json-number">${message.size} bytes</span>
<span class="json-key">Is ChirpStack:</span> <span class="json-boolean">${message.isChirpStack}</span>
${phyPayloadSection}
<span class="json-key">Message Body:</span>
${formattedJson}
        `;
    }

    formatJson(obj, indent = 0) {
        if (obj === null) return '<span class="json-boolean">null</span>';
        if (obj === undefined) return '<span class="json-boolean">undefined</span>';

        const spaces = '  '.repeat(indent);

        if (typeof obj === 'string') {
            return `<span class="json-string">"${obj}"</span>`;
        }

        if (typeof obj === 'number') {
            return `<span class="json-number">${obj}</span>`;
        }

        if (typeof obj === 'boolean') {
            return `<span class="json-boolean">${obj}</span>`;
        }

        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';

            let result = '[\n';
            obj.forEach((item, index) => {
                result += spaces + '  ' + this.formatJson(item, indent + 1);
                if (index < obj.length - 1) result += ',';
                result += '\n';
            });
            result += spaces + ']';
            return result;
        }

        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) return '{}';

            let result = '{\n';
            keys.forEach((key, index) => {
                result += spaces + '  ';
                result += `<span class="json-key">"${key}"</span>: `;
                result += this.formatJson(obj[key], indent + 1);
                if (index < keys.length - 1) result += ',';
                result += '\n';
            });
            result += spaces + '}';
            return result;
        }

        return String(obj);
    }

    updateStatistics(stats) {
        document.getElementById('statTotalMessages').textContent = stats.totalMessages;
        document.getElementById('statChirpStackMessages').textContent = stats.chirpStackMessages;
        document.getElementById('statUniqueGateways').textContent = stats.uniqueGateways;
        document.getElementById('statUniqueDevices').textContent = stats.uniqueDevices;
        document.getElementById('statUplinkMessages').textContent = stats.messageTypes['Uplink'] || 0;
        document.getElementById('statDownlinkMessages').textContent = stats.messageTypes['Downlink'] || 0;
        document.getElementById('statAverageSize').textContent = `${stats.averageSize}B`;
        document.getElementById('statLastUpdate').textContent = new Date().toLocaleTimeString();

        // Update buffer status if available
        if (stats.bufferSize !== undefined) {
            const bufferUsage = Math.round((stats.bufferSize / stats.maxBufferSize) * 100);
            const bufferStatus = document.getElementById('bufferStatus') || this.createBufferStatusElement();
            if (bufferStatus) {
                bufferStatus.textContent = `Buffer: ${stats.bufferSize}/${stats.maxBufferSize} (${bufferUsage}%)`;
                bufferStatus.style.color = bufferUsage > 90 ? '#ff6666' : bufferUsage > 70 ? '#ffff66' : '#66ff66';
            }
        }

        // Update memory statistics if available
        if (stats.memoryStats) {
            this.updateMemoryDisplay(stats.memoryStats);
        }

        // Display gateway message counts if available
        if (stats.gatewayMessageCounts && Object.keys(stats.gatewayMessageCounts).length > 0) {
            this.updateGatewayTable(stats.gatewayMessageCounts);
        } else {
            // Clear the table if no data
            this.gatewayData = [];
            const tbody = document.getElementById('gatewayTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr style="color: #888;"><td colspan="2">No gateway data available</td></tr>';
            }
            const totalElement = document.getElementById('gatewayCountTotal');
            if (totalElement) {
                totalElement.textContent = '0';
            }
        }
    }

    createBufferStatusElement() {
        const statsContainer = document.querySelector('.stats-grid');
        if (statsContainer) {
            const bufferEl = document.createElement('div');
            bufferEl.id = 'bufferStatus';
            bufferEl.style.cssText = 'margin-top: 10px; font-size: 12px; color: #ccc; grid-column: 1 / -1;';
            statsContainer.appendChild(bufferEl);
            return bufferEl;
        }
        return null;
    }

    updateGatewayTable(gatewayMessageCounts) {
        // Convert to array format for table and decode gateway IDs
        this.gatewayData = Object.entries(gatewayMessageCounts).map(([gatewayId, count]) => ({
            gatewayId,
            decodedGatewayId: this.decodeGatewayId(gatewayId),
            count
        }));

        // Update total count
        const totalElement = document.getElementById('gatewayCountTotal');
        if (totalElement) {
            totalElement.textContent = this.gatewayData.length;
        }

        // Render the table
        this.renderGatewayTable();
    }

    renderGatewayTable() {
        const tbody = document.getElementById('gatewayTableBody');
        if (!tbody) {
            return;
        }

        // Sort the data
        const sortedData = [...this.gatewayData].sort((a, b) => {
            let aVal = a[this.gatewaySortField];
            let bVal = b[this.gatewaySortField];

            // Convert to string for gatewayId comparison (use decoded ID for sorting)
            if (this.gatewaySortField === 'gatewayId') {
                aVal = String(a.decodedGatewayId).toLowerCase();
                bVal = String(b.decodedGatewayId).toLowerCase();
            }

            if (this.gatewaySortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        // Clear table
        tbody.innerHTML = '';

        // Populate table
        sortedData.forEach(gateway => {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td class="gateway-id" title="Original: ${gateway.gatewayId}&#10;Decoded: ${gateway.decodedGatewayId}">${gateway.decodedGatewayId}</td>
                <td class="message-count">${gateway.count}</td>
            `;

            // Add click handler to show gateway details
            row.addEventListener('click', () => {
                this.showGatewayDetails(gateway);
            });

            tbody.appendChild(row);
        });

        // Update sort indicators
        this.updateSortIndicators();
    }

    sortGatewayTable(field) {
        if (this.gatewaySortField === field) {
            // Toggle direction if same field
            this.gatewaySortDirection = this.gatewaySortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New field, default to descending for count, ascending for gatewayId
            this.gatewaySortField = field;
            this.gatewaySortDirection = field === 'count' ? 'desc' : 'asc';
        }

        this.renderGatewayTable();
    }

    updateSortIndicators() {
        // Clear all indicators
        document.querySelectorAll('.sort-indicator').forEach(el => {
            el.textContent = '';
        });

        // Set active indicator
        const indicator = document.getElementById(`sort${this.gatewaySortField.charAt(0).toUpperCase() + this.gatewaySortField.slice(1)}`);
        if (indicator) {
            indicator.textContent = this.gatewaySortDirection === 'asc' ? '↑' : '↓';
        }
    }

    showGatewayDetails(gateway) {
        const detailsEl = document.getElementById('messageDetails');
        if (detailsEl) {
            detailsEl.innerHTML = `
<span class="json-key">Gateway Details:</span>

<span class="json-key">Gateway EUI-64:</span> <span class="json-string">${gateway.decodedGatewayId}</span>
<span class="json-key">Original (Base64):</span> <span class="json-string">${gateway.gatewayId}</span>
<span class="json-key">Message Count:</span> <span class="json-number">${gateway.count}</span>

<span style="color: #888; font-size: 10px;">Click on the messages table to filter by this gateway or view individual messages.</span>
            `;
        }
    }

    requestRefresh() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action: 'refreshMessages' }));
        }
    }

    clearMessages() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action: 'clearMessages' }));
        }

        // Clear local data
        this.messages = [];
        this.selectedMessage = null;
        this.gatewayData = [];

        document.getElementById('messageTableBody').innerHTML = '';
        document.getElementById('gatewayTableBody').innerHTML = '';
        document.getElementById('messageDetails').innerHTML = 'Select a message from the table below to view details...';
        document.getElementById('messageCount').textContent = '0';

        const totalElement = document.getElementById('gatewayCountTotal');
        if (totalElement) {
            totalElement.textContent = '0';
        }
    }

    showError(error) {
        const detailsEl = document.getElementById('messageDetails');
        detailsEl.innerHTML = `<span style="color: #ff6666;">ERROR: ${error}</span>`;
    }

    forceMemoryCleanup() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action: 'forceMemoryCleanup' }));
        }
    }

    updateMemoryDisplay(memoryStats) {
        const memoryStatusEl = document.getElementById('memoryStatus');
        if (memoryStatusEl) {
            memoryStatusEl.textContent = `Memory: ${memoryStats.estimatedMemoryMB} MB (${memoryStats.bufferUsagePercent}% buffer)`;
            memoryStatusEl.style.color = memoryStats.bufferUsagePercent > 90 ? '#ff6666' :
                memoryStats.bufferUsagePercent > 70 ? '#ffff66' : '#66ff66';
        }
    }

    showMemoryCleanupResult(cleanup) {
        const detailsEl = document.getElementById('messageDetails');
        detailsEl.innerHTML = `<span style="color: #66ff66;">Memory Cleanup Complete: ${cleanup.messagesRemoved} messages removed, ${cleanup.remainingMessages} remaining</span>`;

        // Auto-clear the message after 5 seconds
        setTimeout(() => {
            if (detailsEl.innerHTML.includes('Memory Cleanup Complete')) {
                detailsEl.innerHTML = 'Select a message from the table below to view details...';
            }
        }, 5000);
    }
}

// Add CSS for selected row
const style = document.createElement('style');
style.textContent = `
    .message-table tr.selected {
        background: #2a4a2a !important;
    }
`;
document.head.appendChild(style);

// Initialize the message monitor when page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MessageMonitorApp();
    window.app = app; // Make it globally accessible for HTML onclick handlers
});