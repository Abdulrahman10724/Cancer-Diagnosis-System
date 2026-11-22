#ifndef JSON_H
#define JSON_H

#include <string>
#include <utility>
#include <vector>

/**
 * @class JsonValue
 * @brief Minimal JSON value and recursive-descent parser for request bodies
 *
 * Objects keep their members in a vector (insertion order); lookup is a linear
 * scan, which is fine for the small request bodies the API receives.
 * Parsing is O(length of the text).
 */
class JsonValue {
public:
    enum Type { Null, Bool, Number, String, Array, Object };

    Type type;
    bool boolean;
    double number;
    std::string text;
    std::vector<JsonValue> items;
    std::vector<std::pair<std::string, JsonValue>> members;

    JsonValue() : type(Null), boolean(false), number(0.0) {}

    const JsonValue* get(const std::string& key) const;
    bool isNull() const { return type == Null; }
    bool isNumber() const { return type == Number; }
    bool isString() const { return type == String; }
    bool isArray() const { return type == Array; }
    bool isObject() const { return type == Object; }

    // Parse a whole document. Returns false and sets error on invalid JSON.
    static bool parse(const std::string& input, JsonValue& out, std::string& error);
};

// Escape a string for use inside JSON quotes
std::string jsonEscape(const std::string& s);
// "text" with escaping
std::string jsonString(const std::string& s);
// Number with up to 6 significant decimals; NaN/infinity become null
std::string jsonNumber(double value);

#endif // JSON_H
