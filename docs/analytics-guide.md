# Analytics Features Guide

## Overview

The Azure Service Bus Explorer PWA includes a powerful analytics engine that automatically analyzes JSON message payloads to provide insights into your message patterns, field usage, and data trends.

## Table of Contents

1. [Analytics Engine](#analytics-engine)
2. [Field Analysis](#field-analysis)
3. [Message Pattern Detection](#message-pattern-detection)
4. [Time Series Analytics](#time-series-analytics)
5. [Correlation Analysis](#correlation-analysis)
6. [Advanced Filtering](#advanced-filtering)
7. [Performance Considerations](#performance-considerations)
8. [Export and Reporting](#export-and-reporting)

## Analytics Engine

### How It Works

The analytics engine processes messages in the background using Web Workers:

1. **JSON Parsing**: Automatically parses message bodies as JSON
2. **Field Extraction**: Discovers all JSON field paths recursively
3. **Type Detection**: Identifies data types for each field
4. **Statistical Analysis**: Calculates frequencies, distributions, and trends
5. **Pattern Recognition**: Identifies common message structures and anomalies

### Real-Time Processing

- Messages are analyzed as they arrive
- Analytics update automatically without user intervention
- Background processing ensures UI remains responsive
- Incremental updates for optimal performance

## Field Analysis

### Field Discovery

The system automatically discovers all JSON fields in your messages:

```json
{
  "user": {
    "id": 12345,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "login"
}
```

Discovered fields:
- `user.id` (number)
- `user.name` (string)
- `user.email` (string)
- `timestamp` (string/datetime)
- `action` (string)

### Field Statistics

For each field, the system provides:

- **Coverage**: Percentage of messages containing this field
- **Data Type**: Primary data type (string, number, boolean, object, array)
- **Unique Values**: Count of distinct values
- **Top Values**: Most frequent values with counts
- **Null Rate**: Percentage of null/undefined values

### Field Detail View

Click any field to see detailed analytics:

1. **Value Distribution Chart**: Visual representation of value frequencies
2. **Time Series**: How field usage changes over time
3. **Sample Values**: Examples of actual field values
4. **Related Fields**: Fields that commonly appear together

## Message Pattern Detection

### Pattern Types

The system identifies several types of patterns:

1. **Structural Patterns**: Common JSON structures
2. **Value Patterns**: Recurring value combinations
3. **Temporal Patterns**: Time-based message patterns
4. **Source Patterns**: Messages from common origins

### Pattern Visualization

- **Message Structure Tree**: Hierarchical view of JSON structures
- **Pattern Frequency Charts**: How often each pattern occurs
- **Pattern Timeline**: When different patterns appear
- **Anomaly Detection**: Unusual patterns that deviate from norms

## Time Series Analytics

### Time-Based Analysis

View how your message data changes over time:

1. **Message Volume**: Messages per time period
2. **Field Trends**: How field usage evolves
3. **Value Trends**: Changes in field values over time
4. **Pattern Evolution**: How message patterns change

### Time Range Selection

- **Predefined Ranges**: Last hour, day, week, month
- **Custom Ranges**: Select specific start and end times
- **Real-Time**: Live updating charts for current data
- **Historical**: Analysis of archived message data

### Chart Types

- **Line Charts**: Trends over time
- **Bar Charts**: Discrete time period comparisons
- **Heatmaps**: Intensity of activity over time periods
- **Scatter Plots**: Correlation between time and values

## Correlation Analysis

### Field Correlations

Understand relationships between different fields:

1. **Co-occurrence**: Fields that appear together
2. **Value Correlations**: Fields with related values
3. **Temporal Correlations**: Fields that change together over time
4. **Structural Correlations**: Fields in similar JSON structures

### Correlation Matrix

Visual representation of field relationships:

- **Heat Map**: Color-coded correlation strengths
- **Interactive**: Click cells to explore specific correlations
- **Filterable**: Focus on specific field groups
- **Exportable**: Save correlation data for external analysis

### Use Cases

- **Data Quality**: Identify missing or inconsistent field relationships
- **Schema Evolution**: Track how message schemas change
- **Integration Points**: Find fields used for system integration
- **Business Logic**: Understand business rule implementations

## Advanced Filtering

### Filter Builder

Create complex filters to focus your analysis:

1. **Field-Based Filters**: Filter by specific field values
2. **Pattern Filters**: Include/exclude specific message patterns
3. **Time Filters**: Limit analysis to specific time ranges
4. **Combination Filters**: Use AND/OR logic for complex criteria

### Filter Types

#### Value Filters
- **Equals**: Exact value matches
- **Contains**: Partial string matches
- **Regex**: Regular expression patterns
- **Range**: Numeric or date ranges
- **Exists**: Field presence/absence

#### Advanced Filters
- **JSON Path**: Complex JSON path expressions
- **Calculated Fields**: Filters based on derived values
- **Cross-Field**: Filters comparing multiple fields
- **Statistical**: Filters based on statistical measures

### Saved Filters

- **Filter Profiles**: Save commonly used filter combinations
- **Quick Access**: Apply saved filters with one click
- **Sharing**: Export filter definitions for team use
- **Templates**: Pre-built filters for common scenarios

## Performance Considerations

### Optimization Strategies

1. **Incremental Processing**: Only analyze new messages
2. **Sampling**: Analyze representative samples for large datasets
3. **Caching**: Cache analysis results for repeated queries
4. **Background Processing**: Use Web Workers to avoid UI blocking

### Performance Settings

- **Batch Size**: Configure message processing batch sizes
- **Update Frequency**: Control how often analytics refresh
- **Memory Limits**: Set maximum memory usage for analytics
- **Cache Duration**: Configure how long to cache results

### Large Dataset Handling

For datasets with 10,000+ messages:

1. **Progressive Loading**: Load and analyze in chunks
2. **Intelligent Sampling**: Analyze representative subsets
3. **Aggregation**: Pre-aggregate common statistics
4. **Lazy Evaluation**: Calculate detailed analytics on demand

## Export and Reporting

### Analytics Export Formats

1. **JSON Export**: Complete analytics data structure
2. **CSV Export**: Tabular data for spreadsheet analysis
3. **PDF Reports**: Formatted reports with charts
4. **Excel Export**: Rich spreadsheet with multiple sheets

### Report Types

#### Summary Reports
- Overall message statistics
- Top fields and values
- Pattern summaries
- Time period comparisons

#### Detailed Reports
- Complete field analysis
- Correlation matrices
- Time series data
- Pattern breakdowns

#### Custom Reports
- User-defined field selections
- Custom time ranges
- Specific pattern focus
- Filtered datasets

### Automated Reporting

1. **Scheduled Reports**: Generate reports automatically
2. **Email Delivery**: Send reports to stakeholders
3. **Report Templates**: Standardized report formats
4. **Threshold Alerts**: Notifications when metrics change

## Advanced Use Cases

### Data Quality Monitoring

Use analytics to monitor data quality:

1. **Schema Validation**: Detect schema violations
2. **Missing Fields**: Identify incomplete messages
3. **Data Type Consistency**: Find type mismatches
4. **Value Range Validation**: Detect out-of-range values

### Business Intelligence

Extract business insights:

1. **User Behavior**: Analyze user action patterns
2. **System Performance**: Monitor system health metrics
3. **Feature Usage**: Track feature adoption
4. **Error Analysis**: Identify common error patterns

### Integration Monitoring

Monitor system integrations:

1. **Message Flow**: Track messages between systems
2. **Transformation Quality**: Verify data transformations
3. **Error Rates**: Monitor integration failure rates
4. **Performance Metrics**: Analyze integration performance

## Best Practices

### Analytics Setup

1. **Start Simple**: Begin with basic field analysis
2. **Focus on Key Fields**: Identify most important fields first
3. **Set Appropriate Time Ranges**: Match analysis period to use case
4. **Regular Review**: Periodically review and update analytics

### Performance Optimization

1. **Use Filters**: Reduce dataset size with relevant filters
2. **Batch Operations**: Process messages in appropriate batches
3. **Monitor Memory**: Keep track of memory usage
4. **Clean Up**: Regularly clean old analytics data

### Data Interpretation

1. **Context Matters**: Consider business context when interpreting results
2. **Trend Analysis**: Look for trends rather than single data points
3. **Correlation vs Causation**: Understand the difference
4. **Validate Findings**: Cross-reference with other data sources