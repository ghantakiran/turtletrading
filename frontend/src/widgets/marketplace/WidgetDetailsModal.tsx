/**
 * Widget Details Modal
 * Detailed view of marketplace widgets with installation, reviews, and metadata
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MarketplaceWidget } from './WidgetMarketplace';

interface WidgetDetailsModalProps {
  widget: MarketplaceWidget;
  onClose: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  onUpdate: () => void;
}

const WidgetDetailsModal: React.FC<WidgetDetailsModalProps> = ({
  widget,
  onClose,
  onInstall,
  onUninstall,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'versions' | 'permissions'>('overview');
  const [selectedVersion, setSelectedVersion] = useState(widget.versions[0]?.version);

  const { config, metadata, stats, reviews, versions } = widget;

  const handleInstallAction = () => {
    if (widget.canUpdate) {
      onUpdate();
    } else if (widget.isInstalled) {
      onUninstall();
    } else {
      onInstall();
    }
    onClose();
  };

  const getActionButtonText = () => {
    if (widget.canUpdate) return 'Update';
    if (widget.isInstalled) return 'Uninstall';
    return 'Install';
  };

  const getActionButtonClass = () => {
    if (widget.canUpdate) return 'btn-primary';
    if (widget.isInstalled) return 'btn-secondary';
    return 'btn-primary';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto"
      data-testid="widget-details-modal"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                {config.previewUrl ? (
                  <img src={config.previewUrl} alt={config.name} className="w-10 h-10 rounded" />
                ) : (
                  <span className="text-primary-600 dark:text-primary-400 text-xl font-bold">
                    {config.name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {config.name}
                  </h2>
                  {metadata.featured && <FeaturedBadge />}
                  {metadata.verified && <VerifiedBadge />}
                  {metadata.premium && <PremiumBadge />}
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  by {config.author.name} • v{config.version}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                {metadata.price > 0 ? (
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${metadata.price}
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-green-600">Free</div>
                )}
                <div className="text-sm text-gray-500">
                  {stats.downloads.toLocaleString()} downloads
                </div>
              </div>

              <button
                onClick={handleInstallAction}
                className={`px-6 py-2 rounded-lg font-medium ${getActionButtonClass()}`}
                data-testid="modal-action-button"
              >
                {getActionButtonText()}
              </button>

              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                data-testid="close-modal"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'reviews', label: `Reviews (${reviews.length})` },
                { id: 'versions', label: `Versions (${versions.length})` },
                { id: 'permissions', label: 'Permissions' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh]">
            {activeTab === 'overview' && (
              <OverviewTab widget={widget} />
            )}

            {activeTab === 'reviews' && (
              <ReviewsTab reviews={reviews} stats={stats} />
            )}

            {activeTab === 'versions' && (
              <VersionsTab versions={versions} selectedVersion={selectedVersion} onVersionSelect={setSelectedVersion} />
            )}

            {activeTab === 'permissions' && (
              <PermissionsTab permissions={config.permissions} />
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

// Overview Tab
const OverviewTab: React.FC<{ widget: MarketplaceWidget }> = ({ widget }) => {
  const { config, metadata, stats, screenshots } = widget;

  return (
    <div className="p-6 space-y-6">
      {/* Description */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          Description
        </h3>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
          {config.description}
        </p>
      </div>

      {/* Screenshots */}
      {screenshots.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Screenshots
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {screenshots.map((screenshot, index) => (
              <img
                key={index}
                src={screenshot}
                alt={`Screenshot ${index + 1}`}
                className="rounded-lg border border-gray-200 dark:border-gray-700"
              />
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Downloads"
          value={stats.downloads.toLocaleString()}
          icon="📥"
        />
        <StatCard
          label="Active Installs"
          value={stats.activeInstalls.toLocaleString()}
          icon="📱"
        />
        <StatCard
          label="Performance"
          value={`${stats.performanceScore}/100`}
          icon="⚡"
        />
        <StatCard
          label="Security"
          value={`${stats.securityScore}/100`}
          icon="🔒"
        />
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Information
          </h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Category:</dt>
              <dd className="text-gray-900 dark:text-white capitalize">{config.category}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Version:</dt>
              <dd className="text-gray-900 dark:text-white">{config.version}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Size:</dt>
              <dd className="text-gray-900 dark:text-white">{formatFileSize(metadata.size)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">License:</dt>
              <dd className="text-gray-900 dark:text-white">{metadata.license}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Last Updated:</dt>
              <dd className="text-gray-900 dark:text-white">
                {metadata.lastUpdated.toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Support
          </h3>
          <div className="space-y-2">
            {metadata.support.documentation && (
              <a
                href={metadata.support.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-primary-600 hover:text-primary-700"
              >
                <DocumentIcon className="w-4 h-4 mr-2" />
                Documentation
              </a>
            )}
            {metadata.support.website && (
              <a
                href={metadata.support.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-primary-600 hover:text-primary-700"
              >
                <GlobeIcon className="w-4 h-4 mr-2" />
                Website
              </a>
            )}
            {metadata.support.email && (
              <a
                href={`mailto:${metadata.support.email}`}
                className="flex items-center text-primary-600 hover:text-primary-700"
              >
                <MailIcon className="w-4 h-4 mr-2" />
                Contact Support
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Reviews Tab
const ReviewsTab: React.FC<{ reviews: any[]; stats: any }> = ({ reviews, stats }) => {
  return (
    <div className="p-6 space-y-6">
      {/* Rating Summary */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.averageRating.toFixed(1)}
            </div>
            <div className="flex items-center justify-center mb-1">
              {[1, 2, 3, 4, 5].map(star => (
                <svg
                  key={star}
                  className={`w-5 h-5 ${star <= Math.round(stats.averageRating) ? 'text-yellow-400' : 'text-gray-300'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="flex-1 ml-8">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = stats.ratingDistribution[rating] || 0;
              const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;

              return (
                <div key={rating} className="flex items-center mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-8">
                    {rating}★
                  </span>
                  <div className="flex-1 mx-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-8">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map(review => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">No reviews yet</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Be the first to review this widget!
          </div>
        </div>
      )}
    </div>
  );
};

// Versions Tab
const VersionsTab: React.FC<{ versions: any[]; selectedVersion: string; onVersionSelect: (version: string) => void }> = ({
  versions,
  selectedVersion,
  onVersionSelect
}) => {
  return (
    <div className="p-6">
      <div className="space-y-4">
        {versions.map(version => (
          <div
            key={version.version}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedVersion === version.version
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => onVersionSelect(version.version)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Version {version.version}
                </h4>
                {version.breaking && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    Breaking Changes
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {version.releaseDate.toLocaleDateString()}
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {version.changelog}
            </p>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>{formatFileSize(version.size)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Permissions Tab
const PermissionsTab: React.FC<{ permissions: any[] }> = ({ permissions }) => {
  const permissionDescriptions = {
    'read:portfolio': 'Read your portfolio holdings and performance data',
    'read:watchlist': 'Access your watchlist and saved stocks',
    'read:market-data': 'Fetch real-time market data and stock prices',
    'read:user-profile': 'Access your basic profile information',
    'write:alerts': 'Create and manage price alerts',
    'write:orders': 'Execute trades and manage orders',
    'external:api': 'Make requests to external services',
    'storage': 'Store data locally on your device',
    'notifications': 'Send browser notifications'
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Required Permissions
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          This widget requests the following permissions to function properly:
        </p>
      </div>

      <div className="space-y-3">
        {permissions.map(permission => (
          <div
            key={permission}
            className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex-shrink-0 w-6 h-6 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
              <CheckIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {permission.replace(/[_:]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {permissionDescriptions[permission as keyof typeof permissionDescriptions] || 'No description available'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {permissions.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">No special permissions required</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            This widget runs in a secure sandbox with no special access
          </div>
        </div>
      )}
    </div>
  );
};

// Supporting Components
const StatCard: React.FC<{ label: string; value: string; icon: string }> = ({ label, value, icon }) => (
  <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
    <div className="text-2xl mb-1">{icon}</div>
    <div className="text-lg font-semibold text-gray-900 dark:text-white">{value}</div>
    <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
  </div>
);

const ReviewCard: React.FC<{ review: any }> = ({ review }) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
          {review.userAvatar ? (
            <img src={review.userAvatar} alt={review.userName} className="w-8 h-8 rounded-full" />
          ) : (
            <span className="text-sm font-medium">{review.userName.charAt(0)}</span>
          )}
        </div>
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{review.userName}</div>
          {review.verified && (
            <span className="text-xs text-green-600">Verified Purchase</span>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map(star => (
            <svg
              key={star}
              className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <span className="text-sm text-gray-500">
          {review.createdAt.toLocaleDateString()}
        </span>
      </div>
    </div>
    {review.title && (
      <h4 className="font-medium text-gray-900 dark:text-white mb-1">{review.title}</h4>
    )}
    <p className="text-gray-700 dark:text-gray-300 text-sm">{review.content}</p>
    {review.helpful > 0 && (
      <div className="mt-2 text-xs text-gray-500">
        {review.helpful} people found this helpful
      </div>
    )}
  </div>
);

// Badges
const FeaturedBadge = () => (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
    ⭐ Featured
  </span>
);

const VerifiedBadge = () => (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
    ✓ Verified
  </span>
);

const PremiumBadge = () => (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
    💎 Premium
  </span>
);

// Icons
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const DocumentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const GlobeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const MailIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Utility functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default WidgetDetailsModal;