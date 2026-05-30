import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getUserAccessToken } from '../authConfig';

const FileTreeItem = ({ item, onDownload, isDownloading }) => {
  const [expanded, setExpanded] = useState(false);

  const isFolder = item.type === 'folder';
  const isCurrentlyDownloading = isDownloading === item.path;

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
    <div style={{ marginLeft: `${(item.level || 0) * 20}px` }}>
      <div className="card mb-2">
        <div className="card-body p-2 p-md-3">
          <div className="row g-2 align-items-start align-items-md-center">
            <div className="col-auto">
              {isFolder && (
                <button
                  onClick={handleToggle}
                  className="btn btn-sm btn-link p-0"
                  style={{ fontSize: '12px' }}
                >
                  {expanded ? '▼' : '▶'}
                </button>
              )}
            </div>
            <div className="col-auto">
              {isFolder && <span style={{ fontSize: '18px' }}>📁</span>}
              {!isFolder && <span style={{ fontSize: '18px' }}>📄</span>}
            </div>
            <div className="col flex-grow-1 text-break">
              <span>{item.name}</span>
            </div>
            {!isFolder && (
              <div className="col-12 col-md-auto">
                <button
                  onClick={handleDownload}
                  disabled={isCurrentlyDownloading}
                  className="btn btn-primary w-100 w-md-auto"
                  style={{
                    opacity: isCurrentlyDownloading ? 0.6 : 1,
                    cursor: isCurrentlyDownloading ? 'default' : 'pointer'
                  }}
                >
                  {isCurrentlyDownloading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Downloading...
                    </>
                  ) : (
                    'Download'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {isFolder && expanded && item.children && item.children.length > 0 && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem
              key={child.path}
              item={{ ...child, level: (item.level || 0) + 1 }}
              onDownload={onDownload}
              isDownloading={isDownloading}
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
  const [downloadingFile, setDownloadingFile] = useState(null);
  const navigate = useNavigate();

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
        
        // Redirect to logout if token acquisition failed or backend returned 401
        if (err.message?.includes('Error getting auth session') || err.response?.status === 401) {
          navigate('/logout?expired=true');
          return;
        }
        
        const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch files';
        setError(`Error: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [navigate]);

  const downloadFile = async (filePath, fileName) => {
    try {
      setDownloadingFile(filePath);
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
      setDownloadingFile(null);
    } catch (err) {
      console.error('Error downloading file:', err);
      setDownloadingFile(null);
      
      // Redirect to logout if token acquisition failed or backend returned 401
      if (err.message?.includes('Error getting auth session') || err.response?.status === 401) {
        navigate('/logout?expired=true');
        return;
      }
      
      setError('Failed to download file.');
    }
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-2 px-md-4">
      <h1 className="mb-4">Files</h1>
      
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      {fileTree.length === 0 ? (
        <p className="text-muted">No files available.</p>
      ) : (
        <div>
          {fileTree.map((item) => (
            <FileTreeItem
              key={item.path}
              item={item}
              onDownload={downloadFile}
              isDownloading={downloadingFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Files;
