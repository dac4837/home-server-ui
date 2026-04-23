import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getUserAccessToken } from '../authConfig';

const FileTreeItem = ({ item, onDownload }) => {
  const [expanded, setExpanded] = useState(false);

  const isFolder = item.type === 'folder';

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!isFolder) {
      onDownload(item.path, item.name);
    }
  };

  const handleToggle = (e) => {
    e.preventDefault();
    setExpanded(!expanded);
  };

  return (
    <div style={{ margin: '0', padding: '0' }}>
      <div
        style={{
          padding: '10px',
          margin: '4px 0',
          border: '1px solid #ddd',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: isFolder ? '#f9f9f9' : '#fff',
          paddingLeft: `${(item.level || 0) * 20}px`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {isFolder && (
            <button
              onClick={handleToggle}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
                width: '20px',
                fontSize: '12px'
              }}
            >
              {expanded ? '▼' : '▶'}
            </button>
          )}
          {isFolder && <span style={{ fontWeight: 'bold' }}>📁</span>}
          {!isFolder && <span>📄</span>}
          <span>{item.name}</span>
        </div>
        {!isFolder && (
          <button
            onClick={handleDownload}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Download
          </button>
        )}
      </div>
      {isFolder && expanded && item.children && item.children.length > 0 && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem
              key={child.path}
              item={{ ...child, level: (item.level || 0) + 1 }}
              onDownload={onDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Files = () => {
  const [fileTree, setFileTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await getUserAccessToken();

        // Fetch files with Bearer token
        const filesResponse = await axios.get(
          `/api/listfiles`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        setFileTree(filesResponse.data);
      } catch (err) {
        console.error('Error fetching files:', err);
        const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch files';
        setError(`Error: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  const downloadFile = async (filePath, fileName) => {
    try {
      const token = await getUserAccessToken();

      // Download file
      const fileResponse = await axios.get(
        `/api/securefiles?path=${encodeURIComponent(filePath)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );

      // Create blob download link
      const url = window.URL.createObjectURL(new Blob([fileResponse.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentElement.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file.');
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '20px' }}>Loading files...</div>;
  }

  return (
    <div className="container" style={{ padding: '20px' }}>
      <h1>Files</h1>
      
      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {fileTree.length === 0 ? (
        <p>No files available.</p>
      ) : (
        <div>
          {fileTree.map((item) => (
            <FileTreeItem
              key={item.path}
              item={item}
              onDownload={downloadFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Files;
