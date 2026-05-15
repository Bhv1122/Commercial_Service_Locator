const api = {
    async runAlgorithm(points) {
        try {
            const response = await fetch('/api/algorithm/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ points })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Algorithm failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            alert(error.message);
            return null;
        }
    }
};
