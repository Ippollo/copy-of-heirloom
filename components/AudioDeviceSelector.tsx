
import React, { useState, useEffect } from 'react';
import { Volume2, Settings2, RefreshCw, Mic } from 'lucide-react';

interface AudioDeviceSelectorProps {
  selectedOutputId?: string;
  setSelectedOutputId?: (id: string) => void;
  selectedInputId?: string;
  setSelectedInputId?: (id: string) => void;
  onClose: () => void;
  showInputOnly?: boolean;
}

const AudioDeviceSelector: React.FC<AudioDeviceSelectorProps> = ({
  selectedOutputId,
  setSelectedOutputId,
  selectedInputId,
  setSelectedInputId,
  onClose,
  showInputOnly = false
}) => {
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);

  const getDevices = async () => {
    try {
      // Request permission first to ensure labels are available
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      setOutputs(devices.filter(d => d.kind === 'audiooutput'));
      setInputs(devices.filter(d => d.kind === 'audioinput'));
      
    } catch (err) {
      console.error("Error fetching devices:", err);
    }
  };

  useEffect(() => {
    getDevices();
  }, []);

  // Filter out duplicate "Default - ..." devices if we are showing the generic "System Default" option
  // We keep the 'default' device ID as the value for "System Default"
  const defaultInputDevice = inputs.find(d => d.deviceId === 'default');
  const otherInputDevices = inputs.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-serif font-bold text-gray-800 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-brand-500" />
            Audio Settings
          </h3>
          <button onClick={getDevices} className="p-2 text-gray-400 hover:text-brand-600 rounded-full transition-colors" title="Refresh Devices">
             <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          
          {/* Microphone Selection */}
          {(showInputOnly || setSelectedInputId) && (
             <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Mic className="w-4 h-4" /> Microphone
                </label>
                <div className="relative">
                    <select
                        value={selectedInputId || 'default'} 
                        onChange={(e) => setSelectedInputId && setSelectedInputId(e.target.value)}
                        className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-200 outline-none text-sm text-gray-700"
                    >
                    {/* Explicitly map System Default to the 'default' ID used by browsers */}
                    <option value="default">System Default</option>
                    
                    {otherInputDevices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                        </option>
                    ))}
                    </select>
                </div>
                {defaultInputDevice && (
                     <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
                        Default: {defaultInputDevice.label.replace('Default - ', '')}
                     </p>
                )}
            </div>
          )}

          {/* Speaker Selection */}
          {!showInputOnly && setSelectedOutputId && (
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Volume2 className="w-4 h-4" /> Speaker
                </label>
                <div className="relative">
                    <select
                    value={selectedOutputId}
                    onChange={(e) => setSelectedOutputId(e.target.value)}
                    disabled={outputs.length === 0}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-200 outline-none text-sm text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                    {outputs.length > 0 ? (
                        outputs.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Speaker ${device.deviceId.slice(0, 5)}...`}
                        </option>
                        ))
                    ) : (
                        <option value="">Default System Output</option>
                    )}
                    </select>
                    {outputs.length === 0 && (
                        <p className="text-[10px] text-gray-400 mt-1 ml-1">
                            Note: Some browsers (like Safari/iOS) do not support changing output devices.
                        </p>
                    )}
                </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioDeviceSelector;
