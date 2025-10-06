import React, { useState, useEffect } from 'react';
import offlineDataService from '../lib/offlineDataService';
import conflictResolver from '../lib/conflictResolver';
import './ConflictResolution.css';

const ConflictResolution = ({ onResolved }) => {
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolutionStrategy, setResolutionStrategy] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    loadConflicts();
  }, []);

  const loadConflicts = async () => {
    try {
      setIsLoading(true);
      const unresolvedConflicts = await offlineDataService.getUnresolvedConflicts();
      setConflicts(unresolvedConflicts);
    } catch (error) {
      console.error('Error loading conflicts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConflictSelect = (conflict) => {
    setSelectedConflict(conflict);
    
    // Get suggested resolution
    const suggestion = conflictResolver.suggestResolution(
      conflict.conflicts || [], 
      conflict.entityType
    );
    setResolutionStrategy(suggestion.strategy);
  };

  const handleResolveConflict = async (strategy) => {
    if (!selectedConflict) return;

    try {
      setIsResolving(true);
      
      let resolvedData;
      if (strategy === 'manual') {
        // For manual resolution, we'll use the local data as default
        // In a real implementation, you'd show a detailed form
        resolvedData = selectedConflict.localData;
      }

      await conflictResolver.resolveConflict(
        selectedConflict.id, 
        strategy, 
        resolvedData
      );

      // Remove resolved conflict from list
      setConflicts(prev => prev.filter(c => c.id !== selectedConflict.id));
      setSelectedConflict(null);
      setResolutionStrategy('');

      if (onResolved) {
        onResolved(selectedConflict.id, strategy);
      }

    } catch (error) {
      console.error('Error resolving conflict:', error);
      alert('Failed to resolve conflict. Please try again.');
    } finally {
      setIsResolving(false);
    }
  };

  const formatEntityType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="conflict-resolution">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading conflicts...</p>
        </div>
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div className="conflict-resolution">
        <div className="no-conflicts">
          <div className="success-icon">✅</div>
          <h3>No Conflicts Found</h3>
          <p>All your data is in sync!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conflict-resolution">
      <div className="conflict-header">
        <h2>Data Conflicts</h2>
        <p>Resolve conflicts between offline and server data</p>
      </div>

      <div className="conflict-layout">
        {/* Conflict List */}
        <div className="conflict-list">
          <h3>Conflicts ({conflicts.length})</h3>
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={`conflict-item ${selectedConflict?.id === conflict.id ? 'selected' : ''}`}
              onClick={() => handleConflictSelect(conflict)}
            >
              <div className="conflict-summary">
                <div className="conflict-type">
                  {formatEntityType(conflict.entityType)}
                </div>
                <div className="conflict-time">
                  {formatTimestamp(conflict.timestamp)}
                </div>
              </div>
              <div className="conflict-details">
                Entity ID: {conflict.entityId}
              </div>
              {conflict.conflictType && (
                <div className="conflict-badge">
                  {conflict.conflictType}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Conflict Details */}
        {selectedConflict && (
          <div className="conflict-details-panel">
            <h3>Conflict Details</h3>
            
            <div className="conflict-info">
              <div className="info-row">
                <strong>Entity:</strong> {formatEntityType(selectedConflict.entityType)}
              </div>
              <div className="info-row">
                <strong>ID:</strong> {selectedConflict.entityId}
              </div>
              <div className="info-row">
                <strong>Detected:</strong> {formatTimestamp(selectedConflict.timestamp)}
              </div>
            </div>

            <div className="data-comparison">
              <div className="data-version">
                <h4>📱 Local Version (Offline)</h4>
                <div className="data-preview">
                  <pre>{JSON.stringify(selectedConflict.localData, null, 2)}</pre>
                </div>
              </div>
              
              <div className="data-version">
                <h4>☁️ Server Version (Online)</h4>
                <div className="data-preview">
                  <pre>{JSON.stringify(selectedConflict.serverData, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="resolution-options">
              <h4>Resolution Options</h4>
              
              <div className="resolution-buttons">
                <button
                  className={`resolution-btn ${resolutionStrategy === 'client-wins' ? 'recommended' : ''}`}
                  onClick={() => handleResolveConflict('client-wins')}
                  disabled={isResolving}
                >
                  📱 Use Local Version
                  {resolutionStrategy === 'client-wins' && <span className="recommended-tag">Recommended</span>}
                </button>
                
                <button
                  className={`resolution-btn ${resolutionStrategy === 'server-wins' ? 'recommended' : ''}`}
                  onClick={() => handleResolveConflict('server-wins')}
                  disabled={isResolving}
                >
                  ☁️ Use Server Version
                  {resolutionStrategy === 'server-wins' && <span className="recommended-tag">Recommended</span>}
                </button>
                
                <button
                  className={`resolution-btn ${resolutionStrategy === 'merge' ? 'recommended' : ''}`}
                  onClick={() => handleResolveConflict('merge')}
                  disabled={isResolving}
                >
                  🔀 Merge Both Versions
                  {resolutionStrategy === 'merge' && <span className="recommended-tag">Recommended</span>}
                </button>
                
                <button
                  className={`resolution-btn manual ${resolutionStrategy === 'manual' ? 'recommended' : ''}`}
                  onClick={() => handleResolveConflict('manual')}
                  disabled={isResolving}
                >
                  ✏️ Manual Resolution
                  {resolutionStrategy === 'manual' && <span className="recommended-tag">Recommended</span>}
                </button>
              </div>
              
              {isResolving && (
                <div className="resolving-state">
                  <div className="spinner"></div>
                  <span>Resolving conflict...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConflictResolution;