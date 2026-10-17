import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
    Moon,
    Sun,
    ImageIcon,
    Loader2,
    UploadCloud,
    Pencil,
    Trash2,
    XCircle,
    ZoomIn,
    ZoomOut,
    RotateCw,
    Camera,
    FileImage,
    Lock,
    Check,
    Grid,
    Folder,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
    SheetClose
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { invalidateCachedImage, useCachedImage } from '@/hooks/useCachedImage';
import { Badge } from '@/components/ui/badge';
import { triggerHaptic } from '@/utils/haptics';
import { Slider } from '@/components/ui/slider';
import Cropper from 'react-easy-crop';

const CLOUDINARY_CLOUD_NAME = 'dsrzawwej';
const CLOUDINARY_UPLOAD_PRESET = 'profiles_pictures';

// Mock sample pictures for in-app custom media picker (grouped by album)
const SAMPLE_MEDIA_ALBUMS = [
    {
        id: 'recent',
        name: 'Recent Photos',
        photos: [
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
        ]
    },
    {
        id: 'camera',
        name: 'Camera',
        photos: [
            'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=600&q=80',
        ]
    },
    {
        id: 'avatars',
        name: 'Avatars & Art',
        photos: [
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80',
        ]
    }
];

// Helper to create a cropped image blob from canvas
const createCroppedImage = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;

    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas toBlob failed'));
            },
            'image/jpeg',
            0.92
        );
    });
};

const ProfileAvatar = ({ user, profileData, displayName, rawUserPlan, userPlanDisplayName, planColors, isHeader }: any) => {
    const queryClient = useQueryClient();
    const { theme, setTheme } = useTheme();

    const [profilePictureError, setProfilePictureError] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Modal Visibility states
    const [showAvatarEditDialog, setShowAvatarEditDialog] = useState(false);
    const [showMediaPickerModal, setShowMediaPickerModal] = useState(false);
    // Permission state persisted across sessions
    const [permissionGranted, setPermissionGranted] = useState<boolean>(() => {
        return localStorage.getItem('android_media_permission') === 'granted';
    });
    const [permissionStatus, setPermissionStatus] = useState<'idle' | 'requesting' | 'granted'>(() => {
        return localStorage.getItem('android_media_permission') === 'granted' ? 'granted' : 'idle';
    });
    const [selectedAlbum, setSelectedAlbum] = useState('gallery');

    // Hidden file inputs for web/device fallbacks
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const customFileInputRef = useRef<HTMLInputElement>(null);

    // Cropper state
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null | undefined>(undefined);
    const userAvatarUrl = avatarUrlOverride !== undefined ? avatarUrlOverride : profileData?.avatar_url;
    const cachedAvatarUrl = useCachedImage(userAvatarUrl);
    const currentPlanColorClasses = planColors[rawUserPlan] || planColors['default'];

    const onCropComplete = useCallback((_croppedArea: any, croppedPixels: any) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const handleFileSelect = (file: File) => {
        setProfilePictureError('');
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSizeMB = 5;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        if (!allowedTypes.includes(file.type)) {
            setProfilePictureError('Invalid file type. Please upload a JPEG, PNG, or WEBP image.');
            return;
        }

        if (file.size > maxSizeBytes) {
            setProfilePictureError(`File size exceeds ${maxSizeMB}MB limit.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setImageSrc(reader.result as string);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setRotation(0);
            setShowMediaPickerModal(false);
        };
        reader.readAsDataURL(file);
    };

    const handleNativeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const handleOpenCamera = async () => {
        try {
            const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
            const photo = await Camera.getPhoto({
                quality: 90,
                allowEditing: true,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Camera,
            });

            if (photo?.dataUrl) {
                setImageSrc(photo.dataUrl);
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setRotation(0);
                setShowMediaPickerModal(false);
                return;
            }
        } catch (err: any) {
            console.warn('Capacitor camera error/cancellation:', err);
            if (err?.message?.includes?.('cancel') || err === 'User cancelled photos app') {
                return;
            }
        }

        try {
            const win = window as any;
            if (win.Capacitor?.isPluginAvailable?.('Camera') && win.Capacitor?.Plugins?.Camera) {
                const photo = await win.Capacitor.Plugins.Camera.getPhoto({
                    quality: 90,
                    allowEditing: true,
                    resultType: 'dataUrl',
                    source: 'CAMERA',
                });

                if (photo?.dataUrl) {
                    setImageSrc(photo.dataUrl);
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                    setRotation(0);
                    setShowMediaPickerModal(false);
                    return;
                }
            }
        } catch (err) {
            console.warn('Capacitor window camera fallback error:', err);
        }

        if (cameraInputRef.current) {
            cameraInputRef.current.value = '';
            cameraInputRef.current.click();
        }
    };

    const handleOpenCameraRoll = () => {
        if (permissionGranted) {
            customFileInputRef.current?.click();
        } else {
            setShowMediaPickerModal(true);
        }
    };

    const handleGrantPermission = () => {
        setPermissionGranted(true);
        localStorage.setItem('android_media_permission', 'granted');
        setShowMediaPickerModal(false);
        toast.success('Media Permission Granted!');
        setTimeout(() => {
            customFileInputRef.current?.click();
        }, 150);
    };

    const handleSelectSamplePhoto = async (photoUrl: string) => {
        try {
            const res = await fetch(photoUrl);
            const blob = await res.blob();
            const file = new File([blob], 'selected_photo.jpg', { type: 'image/jpeg' });
            handleFileSelect(file);
        } catch (err) {
            toast.error('Failed to load selected photo.');
        }
    };

    const uploadFileToCloudinary = async (fileOrBlob: File | Blob) => {
        if (!fileOrBlob) return null;

        const formData = new FormData();
        formData.append('file', fileOrBlob);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
                method: 'POST',
                body: formData,
            });

            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 50));
                setUploadProgress(i);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to upload image to Cloudinary.');
            }

            const data = await response.json();
            setIsUploading(false);
            setUploadProgress(100);
            toast.success('Profile picture updated successfully!');
            return data.secure_url;
        } catch (uploadError: any) {
            console.error('Cloudinary Upload Error:', uploadError);
            setIsUploading(false);
            setUploadProgress(0);
            setProfilePictureError(`Upload failed: ${uploadError.message}`);
            toast.error(`Failed to upload profile picture: ${uploadError.message}`);
            return null;
        }
    };

    const updateAvatarUrlMutation = useMutation({
        mutationFn: async (newAvatarUrl: string) => {
            if (!user?.id) throw new Error('User not authenticated.');
            const { data, error } = await supabase
                .from('profiles')
                .update({ avatar_url: newAvatarUrl })
                .eq('id', user.id);
            if (error) throw error;
            return data as any;
        },
        onSuccess: (_data, newAvatarUrl) => {
            setAvatarUrlOverride(newAvatarUrl);
            invalidateCachedImage(profileData?.avatar_url);
            invalidateCachedImage(newAvatarUrl);
            queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
            queryClient.invalidateQueries({ queryKey: ['profileDropdownProfile', user.id] });
            resetDialogState();
        },
        onError: (err: any) => {
            toast.error(`Failed to update profile: ${err.message}`);
        },
    });

    const deleteAvatarMutation = useMutation({
        mutationFn: async () => {
            if (!user?.id) throw new Error('User not authenticated.');
            const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', user.id);
            if (error) throw error;
        },
        onSuccess: () => {
            setAvatarUrlOverride(null);
            invalidateCachedImage(profileData?.avatar_url);
            queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
            queryClient.invalidateQueries({ queryKey: ['profileDropdownProfile', user.id] });
            toast.success('Profile picture deleted successfully!');
            resetDialogState();
        },
        onError: (err: any) => {
            toast.error(`Failed to delete profile picture: ${err.message}`);
        },
    });

    const resetDialogState = () => {
        setShowAvatarEditDialog(false);
        setShowMediaPickerModal(false);
        setProfilePictureError('');
        setImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setCroppedAreaPixels(null);
    };

    const handleSubmitProfilePicture = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!imageSrc || !croppedAreaPixels) {
            setProfilePictureError('Please select and crop an image.');
            return;
        }
        if (profilePictureError) {
            toast.error('Please fix the error before saving.');
            return;
        }

        try {
            const croppedBlob = await createCroppedImage(imageSrc, croppedAreaPixels);
            const uploadedUrl = await uploadFileToCloudinary(croppedBlob);
            if (uploadedUrl) {
                updateAvatarUrlMutation.mutate(uploadedUrl);
            }
        } catch (err) {
            console.error('Crop error:', err);
            toast.error('Failed to crop image. Please try again.');
        }
    };

    const handleDeleteAvatar = () => {
        deleteAvatarMutation.mutate(undefined);
    };

    const currentAlbumData = SAMPLE_MEDIA_ALBUMS.find(a => a.id === selectedAlbum) || SAMPLE_MEDIA_ALBUMS[0];

    return (
        <>
            {/* Hidden File Inputs for Camera and Gallery */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleNativeFileChange}
            />
            <input
                ref={customFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleNativeFileChange}
            />

            {isHeader ? (
                <div className="flex items-center space-x-3">
                    <Button variant="ghost" size="sm" onClick={() => { triggerHaptic(12); setTheme(theme === "dark" ? "light" : "dark"); }} className="w-9 h-9 p-0 hover:scale-110 transition-transform duration-200">
                        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                    <Badge
                        variant="secondary"
                        className={`hidden sm:flex ${currentPlanColorClasses.light} ${currentPlanColorClasses.dark}`}
                    >
                        {userPlanDisplayName}
                    </Badge>
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={cachedAvatarUrl || undefined} alt={`${displayName.substring(0, 2).toUpperCase() || 'U'} avatar`} />
                        <AvatarFallback className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm">
                            {displayName.substring(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                    </Avatar>
                </div>
            ) : (
                <div className="relative w-24 h-24 mx-auto mb-2 group cursor-pointer" onClick={() => setShowAvatarEditDialog(true)}>
                    {/* Circle Avatar */}
                    <div className="w-full h-full rounded-full overflow-hidden border-4 border-blue-400 dark:border-blue-600 shadow-md">
                        <Avatar className="w-full h-full rounded-full">
                            <AvatarImage src={cachedAvatarUrl || undefined} alt="Profile Avatar" className="w-full h-full object-cover transition-all duration-300 rounded-full" />
                            <AvatarFallback className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white text-3xl font-bold rounded-full">
                                {displayName.substring(0, 1).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    {/* Pencil Edit Icon Badge on Bottom-Right */}
                    <button
                        type="button"
                        className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg border-2 border-white dark:border-gray-900 transition-all duration-200 hover:scale-110 flex items-center justify-center"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowAvatarEditDialog(true);
                        }}
                        aria-label="Edit profile picture"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Main Profile Picture Edit Bottom Sheet */}
            <Sheet open={showAvatarEditDialog} onOpenChange={(open) => { if (!open) resetDialogState(); else setShowAvatarEditDialog(true); }}>
                <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto px-6 pt-6 pb-8 max-w-lg mx-auto border-t border-border shadow-2xl">
                    <SheetHeader className="text-left mb-3">
                        <SheetTitle className="flex items-center gap-2 text-xl font-bold font-syne">
                            <ImageIcon className="h-5 w-5 text-primary" /> Edit Profile Picture
                        </SheetTitle>
                        <SheetDescription>
                            Update your profile photo. Preview is shown in a clean circle.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex flex-col items-center gap-5 py-2">
                        {/* Circle Avatar Preview (matching original circle shape) */}
                        {!imageSrc && (
                            <div className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-primary/30 shadow-xl bg-muted">
                                <Avatar className="w-full h-full rounded-full">
                                    <AvatarImage src={cachedAvatarUrl || undefined} alt="Current Avatar" className="w-full h-full object-cover rounded-full" />
                                    <AvatarFallback className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white text-5xl font-bold rounded-full">
                                        {displayName.substring(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        )}

                        {/* 1:1 Circle Cropper */}
                        {imageSrc && (
                            <div className="w-full flex flex-col gap-3">
                                <div className="relative w-full aspect-square max-h-[280px] rounded-2xl overflow-hidden bg-black mx-auto border border-border/40 shadow-inner">
                                    <Cropper
                                        image={imageSrc}
                                        crop={crop}
                                        zoom={zoom}
                                        rotation={rotation}
                                        aspect={1}
                                        cropShape="round"
                                        showGrid={false}
                                        onCropChange={setCrop}
                                        onZoomChange={setZoom}
                                        onRotationChange={setRotation}
                                        onCropComplete={onCropComplete}
                                    />
                                </div>
                                {/* Zoom & Rotate controls */}
                                <div className="flex items-center gap-3 px-2">
                                    <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <Slider
                                        value={[zoom]}
                                        min={1}
                                        max={3}
                                        step={0.05}
                                        onValueChange={(val) => setZoom(val[0])}
                                        className="flex-1"
                                    />
                                    <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setRotation((r) => (r + 90) % 360)}>
                                        <RotateCw className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Two Main Option Buttons: Take a Picture & Camera Roll */}
                        <div className="w-full space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleOpenCamera}
                                    className="h-14 flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all"
                                >
                                    <Camera className="h-5 w-5 text-primary" />
                                    <span className="text-xs font-semibold">Take a Picture</span>
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleOpenCameraRoll}
                                    className="h-14 flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all"
                                >
                                    <FileImage className="h-5 w-5 text-primary" />
                                    <span className="text-xs font-semibold">Camera Roll</span>
                                </Button>
                            </div>

                            {/* Delete current avatar option */}
                            {userAvatarUrl && !imageSrc && (
                                <Button
                                    variant="ghost"
                                    onClick={handleDeleteAvatar}
                                    disabled={deleteAvatarMutation.isPending}
                                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-2"
                                >
                                    {deleteAvatarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    Remove Current Picture
                                </Button>
                            )}

                            {profilePictureError && (
                                <p className="text-destructive text-xs flex items-center gap-1 justify-center">
                                    <XCircle className="h-3.5 w-3.5" /> {profilePictureError}
                                </p>
                            )}
                        </div>
                    </div>

                    <SheetFooter className="flex-col sm:flex-row gap-2 mt-2">
                        <SheetClose asChild>
                            <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
                        </SheetClose>
                        {imageSrc && (
                            <Button
                                onClick={handleSubmitProfilePicture}
                                disabled={isUploading || updateAvatarUrlMutation.isPending || !imageSrc || !croppedAreaPixels || !!profilePictureError}
                                className="w-full sm:w-auto"
                            >
                                {isUploading || updateAvatarUrlMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <UploadCloud className="mr-2 h-4 w-4" />
                                )}
                                {isUploading ? `Uploading ${uploadProgress.toFixed(0)}%` : 'Save Picture'}
                            </Button>
                        )}
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Custom Android In-App Camera Roll & Permission Sheet Modal */}
            <Sheet open={showMediaPickerModal} onOpenChange={setShowMediaPickerModal}>
                <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto px-6 pt-6 pb-8 max-w-lg mx-auto border-t border-border shadow-2xl">
                    <SheetHeader className="text-left mb-3">
                        <SheetTitle className="text-2xl font-bold font-syne text-foreground tracking-tight">
                            Select A Picture
                        </SheetTitle>
                        <SheetDescription>
                            Browse your photos & albums to choose a new profile picture.
                        </SheetDescription>
                    </SheetHeader>

                    {/* Android Permission Prompt Screen */}
                    {!permissionGranted ? (
                        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 bg-muted/30 rounded-2xl border border-border">
                            <div className="p-4 bg-primary/10 rounded-full text-primary">
                                <Lock className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base font-syne">Android Permission Required</h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                                    Medmacs requires permission to access your device photos and media library.
                                </p>
                            </div>
                            <Button onClick={handleGrantPermission} className="w-full max-w-xs font-semibold gap-2">
                                <Check className="h-4 w-4" /> Allow Access
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 py-4 text-center">
                            <div className="p-5 bg-primary/10 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-primary">
                                <FileImage className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base font-syne">Permission Granted</h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                                    Your Android media permission is active. Click below to select a picture from your device gallery.
                                </p>
                            </div>

                            <Button
                                onClick={() => customFileInputRef.current?.click()}
                                className="w-full font-semibold gap-2 rounded-xl h-12"
                            >
                                <Folder className="h-4 w-4" /> Open Device Gallery
                            </Button>
                        </div>
                    )}

                    <SheetFooter className="mt-4">
                        <SheetClose asChild>
                            <Button variant="outline" className="w-full">Cancel</Button>
                        </SheetClose>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </>
    );
};

export default ProfileAvatar;
