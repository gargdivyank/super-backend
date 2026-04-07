const Lead = require('../models/Lead');

function getEmptyAnalyticsData() {
  return {
    kpis: { new: 0, contacted: 0, qualified: 0, closed: 0 },
    landingPage: null,
    leadsOverTime: { daily: [], monthly: [], yearly: [] },
    bySource: [],
    byLocation: [],
    byDevice: [],
    locationBreakdown: {
      city: [],
      state: [],
      country: []
    }
  };
}

/**
 * Aggregated lead analytics for a Mongo match on leads (e.g. single landing page or $in list).
 * @param {object} match - Filter passed to $match (must scope landing pages appropriately).
 * @param {object|null} landingPageMeta - Populated landing page doc or null.
 */
async function getLeadAnalyticsData(match, landingPageMeta = null) {
  const statusAgg = await Lead.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const counts = { new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };

  statusAgg.forEach((row) => {
    if (row._id && Object.prototype.hasOwnProperty.call(counts, row._id)) {
      counts[row._id] = row.count;
    }
  });

  const kpis = {
    new: counts.new,
    contacted: counts.contacted,
    qualified: counts.qualified,
    closed: counts.converted + counts.lost
  };

  const timeSeries = (format) =>
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format, date: '$createdAt', timezone: 'UTC' }
          },
          leads: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: '$_id', leads: 1 } }
    ]);

  const geoPartsStage = [
    {
      $addFields: {
        rawGeo: {
          $trim: {
            input: { $ifNull: ['$dynamicFields.geoLocation', ''] }
          }
        }
      }
    },
    {
      $addFields: {
        geoParts: {
          $filter: {
            input: {
              $map: {
                input: { $split: ['$rawGeo', ','] },
                as: 'part',
                in: {
                  $trim: { input: '$$part' }
                }
              }
            },
            as: 'part',
            cond: {
              $and: [
                { $ne: ['$$part', ''] },
                { $ne: ['$$part', '-'] },
                { $ne: [{ $toLower: '$$part' }, 'unknown'] },
                { $ne: [{ $toLower: '$$part' }, 'unknown location'] }
              ]
            }
          }
        }
      }
    }
  ];

  const aggregateGeoLevel = async (level) => {
    let fieldExpr;

    if (level === 'country') {
      fieldExpr = {
        $cond: [
          { $gt: [{ $size: '$geoParts' }, 0] },
          { $arrayElemAt: ['$geoParts', -1] },
          'Unknown'
        ]
      };
    } else if (level === 'state') {
      fieldExpr = {
        $cond: [
          { $gt: [{ $size: '$geoParts' }, 1] },
          { $arrayElemAt: ['$geoParts', -2] },
          'Unknown'
        ]
      };
    } else if (level === 'city') {
      fieldExpr = {
        $cond: [
          { $gt: [{ $size: '$geoParts' }, 2] },
          { $arrayElemAt: ['$geoParts', -3] },
          'Unknown'
        ]
      };
    }

    const rows = await Lead.aggregate([
      { $match: match },
      ...geoPartsStage,
      {
        $addFields: {
          geoValue: fieldExpr
        }
      },
      {
        $group: {
          _id: '$geoValue',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          [level]: '$_id',
          count: 1
        }
      }
    ]);

    const topRows = rows.slice(0, 15);
    const otherCount = rows.slice(15).reduce((sum, row) => sum + row.count, 0);

    return otherCount > 0
      ? [...topRows, { [level]: 'Other', count: otherCount }]
      : topRows;
  };

  const [daily, monthly, yearly, bySourceRaw, locAgg, byDeviceRaw, byCity, byState, byCountry] =
    await Promise.all([
      timeSeries('%Y-%m-%d'),
      timeSeries('%Y-%m'),
      timeSeries('%Y'),
      Lead.aggregate([
        { $match: match },
        {
          $addFields: {
            src: {
              $trim: {
                input: { $ifNull: ['$source', ''] }
              }
            }
          }
        },
        {
          $addFields: {
            src: {
              $cond: [{ $eq: ['$src', ''] }, 'Unknown', '$src']
            }
          }
        },
        { $group: { _id: '$src', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, source: '$_id', count: 1 } }
      ]),
      Lead.aggregate([
        { $match: match },
        {
          $addFields: {
            loc: {
              $trim: {
                input: { $ifNull: ['$dynamicFields.geoLocation', ''] }
              }
            }
          }
        },
        {
          $addFields: {
            loc: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$loc', ''] },
                    { $eq: ['$loc', 'Unknown location'] }
                  ]
                },
                'Unknown',
                '$loc'
              ]
            }
          }
        },
        { $group: { _id: '$loc', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Lead.aggregate([
        { $match: match },
        {
          $addFields: {
            rawDevice: {
              $ifNull: ['$dynamicFields.deviceType', '']
            }
          }
        },
        {
          $addFields: {
            bucket: {
              $switch: {
                branches: [
                  {
                    case: {
                      $in: [
                        { $toLower: '$rawDevice' },
                        ['mobile', 'tablet']
                      ]
                    },
                    then: 'Mobile'
                  },
                  {
                    case: {
                      $eq: [{ $toLower: '$rawDevice' }, 'desktop']
                    },
                    then: 'Desktop'
                  }
                ],
                default: 'Unknown'
              }
            }
          }
        },
        { $group: { _id: '$bucket', count: { $sum: 1 } } },
        { $project: { _id: 0, device: '$_id', count: 1 } },
        { $sort: { count: -1 } }
      ]),
      aggregateGeoLevel('city'),
      aggregateGeoLevel('state'),
      aggregateGeoLevel('country')
    ]);

  const locRows = locAgg.map((x) => ({ location: x._id, count: x.count }));
  const topLoc = locRows.slice(0, 15);
  const otherLocSum = locRows.slice(15).reduce((acc, r) => acc + r.count, 0);

  const byLocation =
    otherLocSum > 0
      ? [...topLoc, { location: 'Other', count: otherLocSum }]
      : topLoc;

  return {
    kpis,
    landingPage: landingPageMeta,
    leadsOverTime: { daily, monthly, yearly },
    bySource: bySourceRaw,
    byLocation,
    byDevice: byDeviceRaw,
    locationBreakdown: {
      city: byCity,
      state: byState,
      country: byCountry
    }
  };
}

module.exports = {
  getLeadAnalyticsData,
  getEmptyAnalyticsData
};
