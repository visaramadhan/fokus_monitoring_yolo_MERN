import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { 
  Settings as SettingsIcon, 
  Camera, 
  Database, 
  Brain, 
  Upload, 
  Check, 
  X,
  Save,
  TestTube,
  Zap,
  Shield,
  Clock,
  Bell,
  UploadCloud,
  Trash2,
  Download,
  Cloud
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface SettingsData {
  // General Settings
  autoDetection: boolean;
  recordingSessions: boolean;
  notifications: boolean;
  dataRetentionDays: number;
  
  // Camera & Detection Settings
  cameraResolution: string;
  frameRate: number;
  detectionThreshold: number;
  
  // Database Configuration
  mongodbUri: string;
  backupInterval: number;
  
  // YOLO Model Configuration
  modelPath: string;
  modelType: string;
  confidenceThreshold: number;
  iouThreshold: number;
  modelStatus: string;
  
  // Live Monitoring Settings
  liveMonitoring: boolean;
  selectedCamera: string;
}

interface FirebaseModel {
  id: string;
  name: string;
  fileName: string;
  downloadURL: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: 'uploading' | 'ready' | 'error';
}

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [firebaseModels, setFirebaseModels] = useState<FirebaseModel[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchFirebaseModels();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchFirebaseModels = async () => {
    try {
      // Simulate Firebase model fetching
      const mockModels: FirebaseModel[] = [
        {
          id: '1',
          name: 'YOLOv8 Face Detection Model',
          fileName: 'yolov8_face_detection.pt',
          downloadURL: 'https://firebasestorage.googleapis.com/v0/b/focus-monitoring/o/models%2Fyolov8_face_detection.pt',
          type: 'pytorch',
          size: 52428800, // 50MB
          uploadedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          status: 'ready'
        },
        {
          id: '2',
          name: 'YOLOv8 Head Detection Model',
          fileName: 'yolov8_head_detection.pt',
          downloadURL: 'https://firebasestorage.googleapis.com/v0/b/focus-monitoring/o/models%2Fyolov8_head_detection.pt',
          type: 'pytorch',
          size: 48234567, // 46MB
          uploadedAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          status: 'ready'
        }
      ];
      setFirebaseModels(mockModels);
    } catch (error) {
      console.error('Error fetching Firebase models:', error);
      toast.error('Failed to fetch models from Firebase');
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      await axios.put('/settings', settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testModel = async (modelId: string) => {
    setTestingModel(true);
    try {
      // Simulate model testing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const updatedModels = firebaseModels.map(model => 
        model.id === modelId 
          ? { ...model, status: 'ready' as const }
          : model
      );
      setFirebaseModels(updatedModels);
      
      toast.success('Model test successful');
    } catch (error: any) {
      toast.error('Model test failed');
    } finally {
      setTestingModel(false);
    }
  };

  const uploadModelToFirebase = async (file: File) => {
    setUploadingModel(true);
    
    try {
      // Create temporary model entry
      const tempModel: FirebaseModel = {
        id: Date.now().toString(),
        name: file.name.replace(/\.[^/.]+$/, ""),
        fileName: file.name,
        downloadURL: '',
        type: getModelType(file.name),
        size: file.size,
        uploadedAt: new Date().toISOString(),
        status: 'uploading'
      };
      
      setFirebaseModels(prev => [...prev, tempModel]);
      
      // Simulate Firebase upload
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate successful upload
      const uploadedModel: FirebaseModel = {
        ...tempModel,
        downloadURL: `https://firebasestorage.googleapis.com/v0/b/focus-monitoring/o/models%2F${encodeURIComponent(file.name)}`,
        status: 'ready'
      };
      
      setFirebaseModels(prev => 
        prev.map(model => 
          model.id === tempModel.id ? uploadedModel : model
        )
      );
      
      toast.success('Model uploaded to Firebase successfully');
    } catch (error: any) {
      toast.error('Failed to upload model to Firebase');
      
      // Remove failed upload
      setFirebaseModels(prev => 
        prev.filter(model => model.status !== 'uploading')
      );
    } finally {
      setUploadingModel(false);
    }
  };

  const deleteModelFromFirebase = async (modelId: string) => {
    if (!window.confirm('Are you sure you want to delete this model?')) return;
    
    try {
      // Simulate Firebase deletion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setFirebaseModels(prev => prev.filter(model => model.id !== modelId));
      toast.success('Model deleted from Firebase');
    } catch (error) {
      toast.error('Failed to delete model');
    }
  };

  const downloadModel = async (model: FirebaseModel) => {
    try {
      // Simulate download
      toast.success(`Downloading ${model.name}...`);
      
      // In a real implementation, you would:
      // const response = await fetch(model.downloadURL);
      // const blob = await response.blob();
      // const url = window.URL.createObjectURL(blob);
      // const a = document.createElement('a');
      // a.href = url;
      // a.download = model.fileName;
      // a.click();
      
    } catch (error) {
      toast.error('Failed to download model');
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    await uploadModelToFirebase(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.pt'],
      'application/x-onnx': ['.onnx'],
      'application/x-protobuf': ['.pb']
    },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024 // 500MB
  });

  const getModelType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pt': return 'pytorch';
      case 'onnx': return 'onnx';
      case 'pb': return 'tensorflow';
      default: return 'unknown';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-500">You need admin privileges to access settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl p-6 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <SettingsIcon className="h-8 w-8 mr-3" />
              System Settings
            </h1>
            <p className="mt-2 opacity-90">Configure system behavior and model parameters</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center px-6 py-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg font-medium hover:bg-opacity-30 transition-all duration-200"
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? 'Saving...' : 'Save All'}
          </motion.button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <SettingsIcon className="h-5 w-5 mr-2 text-blue-600" />
            General Settings
          </h3>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Zap className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <label className="text-sm font-medium text-gray-900">Auto Detection</label>
                  <p className="text-xs text-gray-500">Automatically start focus detection</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSettings({ ...settings, autoDetection: !settings.autoDetection })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.autoDetection ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.autoDetection ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </motion.button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Camera className="h-5 w-5 text-purple-600 mr-3" />
                <div>
                  <label className="text-sm font-medium text-gray-900">Recording Sessions</label>
                  <p className="text-xs text-gray-500">Record session data automatically</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSettings({ ...settings, recordingSessions: !settings.recordingSessions })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.recordingSessions ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.recordingSessions ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </motion.button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bell className="h-5 w-5 text-orange-600 mr-3" />
                <div>
                  <label className="text-sm font-medium text-gray-900">Notifications</label>
                  <p className="text-xs text-gray-500">Enable system notifications</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSettings({ ...settings, notifications: !settings.notifications })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notifications ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </motion.button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center">
                <Clock className="h-4 w-4 text-red-600 mr-2" />
                Data Retention (days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.dataRetentionDays}
                onChange={(e) => setSettings({ ...settings, dataRetentionDays: parseInt(e.target.value) })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Camera & Detection Settings */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Camera className="h-5 w-5 mr-2 text-green-600" />
            Camera & Detection Settings
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Camera Resolution</label>
              <select
                value={settings?.cameraResolution ?? ''}
                onChange={(e) => settings && setSettings({ ...settings, cameraResolution: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="1920x1080">1920x1080 (Full HD)</option>
                <option value="1280x720">1280x720 (HD)</option>
                <option value="640x480">640x480 (SD)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Frame Rate (FPS)</label>
              <input
                type="number"
                min="15"
                max="60"
                value={settings?.frameRate ?? ''}
                onChange={(e) => settings && setSettings({ ...settings, frameRate: parseInt(e.target.value) })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Detection Threshold (%)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={settings && settings.detectionThreshold != null ? settings.detectionThreshold * 100 : 0}
                  onChange={(e) => settings && setSettings({ ...settings, detectionThreshold: parseInt(e.target.value) / 100 })}
                  className="flex-1"
                />
                <span className="text-sm font-medium text-gray-900 w-12">
                  {settings ? Math.round(settings.detectionThreshold * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Database Configuration */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Database className="h-5 w-5 mr-2 text-blue-600" />
            Database Configuration
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">MongoDB Connection URI</label>
              <input
                type="text"
                value={settings.mongodbUri}
                onChange={(e) => setSettings({ ...settings, mongodbUri: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="mongodb+srv://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Backup Interval (hours)</label>
              <input
                type="number"
                min="1"
                max="168"
                value={settings.backupInterval}
                onChange={(e) => setSettings({ ...settings, backupInterval: parseInt(e.target.value) })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Firebase Model Management */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Cloud className="h-5 w-5 mr-2 text-purple-600" />
            Firebase Model Management
          </h3>
          
          <div className="space-y-6">
            {/* Model Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Upload YOLO Model to Firebase</label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                {uploadingModel ? (
                  <p className="text-sm text-blue-600">Uploading to Firebase...</p>
                ) : isDragActive ? (
                  <p className="text-sm text-blue-600">Drop the model file here...</p>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600">Drag & drop a model file here, or click to select</p>
                    <p className="text-xs text-gray-500 mt-1">Supported: .pt (PyTorch), .onnx (ONNX), .pb (TensorFlow)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Model Parameters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Confidence Threshold</label>
                <input
                  type="number"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={settings.confidenceThreshold}
                  onChange={(e) => setSettings({ ...settings, confidenceThreshold: parseFloat(e.target.value) })}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">IoU Threshold</label>
                <input
                  type="number"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={settings.iouThreshold}
                  onChange={(e) => setSettings({ ...settings, iouThreshold: parseFloat(e.target.value) })}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Firebase Models List */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Brain className="h-5 w-5 mr-2 text-purple-600" />
            Firebase Models ({firebaseModels.length})
          </h3>
        </div>
        
        <div className="p-6">
          {firebaseModels.length > 0 ? (
            <div className="space-y-4">
              {firebaseModels.map((model) => (
                <motion.div 
                  key={model.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      model.status === 'ready' ? 'bg-green-500' :
                      model.status === 'uploading' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <h4 className="font-medium text-gray-900">{model.name}</h4>
                      <p className="text-sm text-gray-500">{model.fileName}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-400 mt-1">
                        <span>{formatFileSize(model.size)}</span>
                        <span>{model.type}</span>
                        <span>{new Date(model.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {model.status === 'ready' && (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => testModel(model.id)}
                          disabled={testingModel}
                          className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 disabled:opacity-50"
                        >
                          <TestTube className="h-4 w-4 mr-1" />
                          {testingModel ? 'Testing...' : 'Test'}
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => downloadModel(model)}
                          className="flex items-center px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </motion.button>
                      </>
                    )}
                    
                    {model.status === 'uploading' && (
                      <div className="flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-700 mr-2"></div>
                        Uploading...
                      </div>
                    )}
                    
                    {model.status !== 'uploading' && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => deleteModelFromFirebase(model.id)}
                        className="flex items-center px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Brain className="h-8 w-8 mx-auto mb-2" />
              <p>No models uploaded to Firebase yet</p>
              <p className="text-sm">Upload your first YOLO model above</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}